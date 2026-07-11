// =========================================================
// Extracción de PLANOS (SOLO servidor) — separado de extract.ts (pliego).
// Saca el texto con coordenadas y la geometría vectorial con MuPDF, y
// clasifica vectorial vs escaneado. El conteo determinístico (heurísticas
// de texto + firmas geométricas + validación cruzada) se calibra contra
// planos reales en la mitad B de F2; este módulo entrega la MATERIA PRIMA.
// =========================================================

export type TextToken = {
  text: string;
  x: number; // centro normalizado 0-1
  y: number;
  size: number;
};

export type VectorShape = {
  cx: number; // centro del bounding box, normalizado 0-1
  cy: number;
  w: number; // ancho/alto normalizados
  h: number;
  kind: "circle" | "rect" | "path"; // clasificación gruesa por geometría
};

export type SheetExtract = {
  isVector: boolean;
  pageWidth: number;
  pageHeight: number;
  tokens: TextToken[];
  shapes: VectorShape[];
  /** JPG base64 del plano completo (para el visor y la lectura de leyenda). */
  imageBase64: string;
};

// MuPDF asJSON entrega bbox como { x, y, w, h } (no como array [x0,y0,x1,y1]).
type BBox = { x: number; y: number; w: number; h: number };
type StLine = { text?: string; bbox?: BBox; font?: { size?: number } };
type StBlock = { type?: string; lines?: StLine[]; bbox?: BBox };

const bboxCenter = (b: BBox | undefined, W: number, H: number) => {
  if (!b || typeof b.x !== "number" || typeof b.w !== "number") return null;
  return {
    cx: (b.x + b.w / 2) / W,
    cy: (b.y + b.h / 2) / H,
    w: b.w / W,
    h: b.h / H,
  };
};

function destroyQuiet(obj: unknown) {
  (obj as { destroy?: () => void }).destroy?.();
}

export async function extractSheet(
  pdf: Uint8Array,
  pageIndex0 = 0,
): Promise<SheetExtract> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const page = doc.loadPage(pageIndex0);
    const [x0, y0, x1, y1] = page.getBounds();
    const W = Math.abs(x1 - x0) || 1;
    const H = Math.abs(y1 - y0) || 1;

    // ── Texto con coordenadas ──
    const tokens: TextToken[] = [];
    let charCount = 0;
    try {
      const st = JSON.parse(page.toStructuredText().asJSON()) as {
        blocks?: StBlock[];
      };
      for (const b of st.blocks ?? []) {
        for (const l of b.lines ?? []) {
          const text = (l.text ?? "").trim();
          charCount += text.length;
          if (!text) continue;
          const c = bboxCenter(l.bbox, W, H);
          if (!c) continue;
          tokens.push({ text, x: c.cx, y: c.cy, size: Number(l.font?.size ?? 0) });
        }
      }
    } catch {
      /* sin texto estructurado */
    }

    // ── Geometría vectorial (drawings): clasificación gruesa por forma ──
    const shapes: VectorShape[] = [];
    try {
      // getDrawings no está tipado en el .d.ts; se accede dinámicamente.
      const draw = (page as unknown as { getDrawings?: () => unknown[] }).getDrawings?.();
      for (const d of draw ?? []) {
        // getDrawings entrega rect como array [x0,y0,x1,y1] (distinto del
        // structured text). Se normaliza a centro/ancho aquí mismo.
        const r = (d as { rect?: number[] }).rect;
        if (!r || r.length < 4) continue;
        const c = {
          cx: (r[0] + r[2]) / 2 / W,
          cy: (r[1] + r[3]) / 2 / H,
          w: Math.abs(r[2] - r[0]) / W,
          h: Math.abs(r[3] - r[1]) / H,
        };
        // Ruido: descartar trazos enormes (bordes/cajetín) y milimétricos.
        if (c.w > 0.25 || c.h > 0.25 || c.w < 0.002 || c.h < 0.002) continue;
        const ratio = c.w / (c.h || 1);
        const items = (d as { items?: unknown[] }).items ?? [];
        const hasCurve = items.some(
          (it) => Array.isArray(it) && (it[0] === "c" || it[0] === "curveTo"),
        );
        const kind: VectorShape["kind"] =
          hasCurve && ratio > 0.7 && ratio < 1.4
            ? "circle"
            : ratio > 0.6 && ratio < 1.7
              ? "rect"
              : "path";
        shapes.push({ cx: c.cx, cy: c.cy, w: c.w, h: c.h, kind });
      }
    } catch {
      /* sin drawings accesibles */
    }

    const isVector = charCount > 40 || shapes.length > 20;

    // ── Imagen del plano completo (para visor y lectura de leyenda) ──
    const pix = page.toPixmap(
      mupdf.Matrix.scale(2, 2),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    let imageBase64 = "";
    try {
      imageBase64 = Buffer.from(pix.asJPEG(60, false)).toString("base64");
    } finally {
      destroyQuiet(pix);
    }

    return {
      isVector,
      pageWidth: W,
      pageHeight: H,
      tokens,
      shapes,
      imageBase64,
    };
  } finally {
    destroyQuiet(doc);
  }
}

/** Recorte JPG de una región normalizada (para enviar la leyenda a visión). */
export async function cropRegionJpeg(
  pdf: Uint8Array,
  region: { x: number; y: number; w: number; h: number },
  pageIndex0 = 0,
): Promise<string> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const page = doc.loadPage(pageIndex0);
    const pix = page.toPixmap(
      mupdf.Matrix.scale(3, 3),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    try {
      // asJPEG del pixmap completo; el recorte fino se hace por prompt (la
      // región se describe al modelo). Mantiene el módulo simple y sin libs
      // de imagen extra. (Se afina en la calibración con plano real.)
      return Buffer.from(pix.asJPEG(70, false)).toString("base64");
    } finally {
      destroyQuiet(pix);
    }
  } finally {
    destroyQuiet(doc);
  }
}
