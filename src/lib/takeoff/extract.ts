// =========================================================
// Extracción PDF → Markdown con anclas de página (SOLO servidor).
// mupdf es WASM (serverExternalPackages); se importa dinámico.
// Principio del motor: código primero — la IA recibe documento
// estructurado, y las páginas sin texto confiable se marcan para
// el fallback de visión (se envían como imagen a Claude).
// =========================================================

export type ExtractedPage = {
  page: number; // 1-indexed
  md: string; // markdown de la página (con encabezados por tamaño de fuente)
  chars: number;
  needsVision: boolean; // texto pobre → candidata a visión por imagen
};

type StLine = { text?: string; font?: { size?: number }; bbox?: unknown };
type StBlock = { type?: string; lines?: StLine[] };

const VISION_MIN_CHARS = 80; // debajo de esto la página se considera sin texto útil

export async function extractPdfMarkdown(pdf: Uint8Array): Promise<{
  pages: ExtractedPage[];
  pageCount: number;
}> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const pageCount = doc.countPages();
  const pages: ExtractedPage[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    let md = "";
    let chars = 0;
    try {
      const st = JSON.parse(page.toStructuredText().asJSON()) as {
        blocks?: StBlock[];
      };
      const lines: { text: string; size: number }[] = [];
      for (const b of st.blocks ?? []) {
        for (const l of b.lines ?? []) {
          const text = (l.text ?? "").trim();
          if (!text) continue;
          lines.push({ text, size: Number(l.font?.size ?? 0) });
        }
      }
      chars = lines.reduce((a, l) => a + l.text.length, 0);
      // Heurística de encabezados: líneas cortas con fuente claramente mayor
      // a la mediana se marcan como "##" (estructura tipo Markdown).
      const sizes = lines.map((l) => l.size).filter((s) => s > 0).sort((a, b) => a - b);
      const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
      md = lines
        .map((l) =>
          median > 0 && l.size > median * 1.3 && l.text.length < 90
            ? `\n## ${l.text}\n`
            : l.text,
        )
        .join("\n");
    } catch {
      md = "";
      chars = 0;
    }
    pages.push({
      page: i + 1,
      md: `\n[p. ${i + 1}]\n${md}`,
      chars,
      needsVision: chars < VISION_MIN_CHARS,
    });
  }
  return { pages, pageCount };
}

/** Render de UNA página a JPG (base64) para el fallback de visión. */
export async function renderPageJpeg(
  pdf: Uint8Array,
  pageIndex0: number,
  scale = 2,
): Promise<string> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const page = doc.loadPage(pageIndex0);
  const pix = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true,
  );
  const jpg = pix.asJPEG(70, false);
  return Buffer.from(jpg).toString("base64");
}

export type ScopeChunk = {
  index: number;
  pageFrom: number;
  pageTo: number;
  md: string; // texto del fragmento (con anclas [p. N])
  visionPages: number[]; // páginas del fragmento que van como imagen
};

const CHUNK_CHARS = 14000; // ~4-5k tokens por fragmento: llamadas cortas y citables

/** Agrupa páginas consecutivas en fragmentos manejables para el análisis. */
export function chunkPages(pages: ExtractedPage[]): ScopeChunk[] {
  const chunks: ScopeChunk[] = [];
  let buf: ExtractedPage[] = [];
  let size = 0;
  const flush = () => {
    if (!buf.length) return;
    chunks.push({
      index: chunks.length,
      pageFrom: buf[0].page,
      pageTo: buf[buf.length - 1].page,
      md: buf.map((p) => p.md).join("\n"),
      visionPages: buf.filter((p) => p.needsVision).map((p) => p.page),
    });
    buf = [];
    size = 0;
  };
  for (const p of pages) {
    buf.push(p);
    size += p.md.length;
    if (size >= CHUNK_CHARS) flush();
  }
  flush();
  return chunks;
}
