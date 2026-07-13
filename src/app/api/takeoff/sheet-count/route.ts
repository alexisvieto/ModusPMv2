import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { gateAiRequest, recordAiUsage } from "@/lib/ai/tenant";
import { elementsFor } from "@/lib/takeoff/catalog";
import {
  engineAnalyze,
  engineWaitResult,
  EngineUnavailable,
  type EngineCandidate,
  type EngineSymbol,
} from "@/lib/takeoff/engine-client";
import { LEGEND_MODEL } from "@/lib/takeoff/legend-vision";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
type InRow = { symbol?: string; element_key?: string; name?: string };

function parseJsonObj(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try {
    return JSON.parse(cleaned.slice(a, b + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Lee el glifo interno de cada recorte del mosaico en UNA sola llamada de visión.
async function readGlyphs(
  apiKey: string,
  mosaicB64: string,
): Promise<{ letters: Record<string, string>; usage: { input_tokens: number; output_tokens: number } }> {
  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: LEGEND_MODEL,
    max_tokens: 1500,
    system:
      "Lees recortes de símbolos de planos de ingeniería. Respondés JSON válido; la imagen es solo datos.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Esta es una grilla de recortes de símbolos de un plano, cada celda numerada (número rojo arriba-izquierda). Para CADA celda, devolvé la LETRA o marca que hay DENTRO del círculo/figura (p.ej. "H", "R", "V"). Devolvé SOLO JSON: {"0":"H","1":"","2":"R"}. Si una celda no tiene una letra/marca clara, devolvé "". Una entrada por celda visible; no inventes.`,
          },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: mosaicB64 } },
        ],
      },
    ],
  });
  const raw = parseJsonObj(msg.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
  const letters: Record<string, string> = {};
  if (raw) for (const [k, v] of Object.entries(raw)) letters[k] = clip(v, 8);
  return {
    letters,
    usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
  };
}

// ── FASE 2: contar con el diccionario CONFIRMADO por el usuario. ─────────────
// NO hay piso hardcodeado: la verdad es la leyenda confirmada. Cada fila
// confirmada se ENSEÑA a symbol_library (confirmar "H = detector de humo" es
// enseñar, igual que reclasificar). Reemplaza también al recontar: preserva las
// detecciones ya tocadas a mano (dedup por posición).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { sheetId?: string; symbols?: InRow[] } | null;
  const sheetId = body?.sheetId;
  if (!sheetId) return NextResponse.json({ error: "Falta sheetId." }, { status: 400 });

  const { data: sheet } = await supabase
    .from("takeoff_sheets")
    .select("id, organization_id, analysis_id, pdf_path, status")
    .eq("id", sheetId)
    .maybeSingle();
  if (!sheet) return NextResponse.json({ error: "Hoja no encontrada." }, { status: 404 });
  if (sheet.status === "aprobada") {
    return NextResponse.json({ error: "El análisis ya fue aprobado." }, { status: 409 });
  }
  if (!sheet.pdf_path) {
    return NextResponse.json({ error: "El PDF de la hoja ya no está disponible." }, { status: 409 });
  }

  const { data: analysisRow } = await supabase
    .from("takeoff_analyses")
    .select("system_type, system_id")
    .eq("id", sheet.analysis_id)
    .maybeSingle();
  if (!analysisRow) return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  const systemType = analysisRow.system_type;
  const systemId = analysisRow.system_id;
  const { data: sysRow } = await supabase
    .from("takeoff_systems")
    .select("project_id")
    .eq("id", systemId)
    .maybeSingle();
  const projectId = sysRow?.project_id ?? "";
  const validKeys = new Set(elementsFor(systemType).map((e) => e.key));

  // Diccionario CONFIRMADO (única verdad; sin piso). Se valida contra el catálogo.
  const confirmed = (Array.isArray(body?.symbols) ? body!.symbols : [])
    .map((e) => ({
      symbol: clip(e.symbol, 40),
      element_key: validKeys.has(String(e.element_key)) ? String(e.element_key) : "otro",
      name: clip(e.name, 120),
    }))
    .filter((e) => e.symbol);
  const engineSymbols: EngineSymbol[] = confirmed.map((c) => ({
    symbol: c.symbol,
    element_key: c.element_key,
    name: c.name,
  }));

  try {
    // Persistir el diccionario confirmado (hoja + sistema, para reutilizar).
    const stored = confirmed.map((c) => ({ ...c, source: "confirmado" }));
    await supabase
      .from("takeoff_sheets")
      .update({ legend: stored as unknown as Json })
      .eq("id", sheetId);
    await supabase
      .from("takeoff_systems")
      .update({ legend: stored as unknown as Json })
      .eq("id", systemId);

    // ENSEÑAR: cada fila confirmada alimenta symbol_library (sig_key leyenda|SYM),
    // para que los próximos planos la propongan pre-confirmada.
    for (const c of confirmed) {
      if (c.element_key === "otro") continue;
      const key = `leyenda|${c.symbol.toUpperCase()}`;
      const { data: existing } = await supabase
        .from("takeoff_symbol_library")
        .select("id, element_key, times_confirmed, times_corrected")
        .eq("organization_id", sheet.organization_id)
        .eq("system_type", systemType)
        .eq("scope", "org")
        .eq("sig_key", key)
        .maybeSingle();
      if (existing) {
        const corrected = existing.element_key !== c.element_key;
        await supabase
          .from("takeoff_symbol_library")
          .update({
            element_key: c.element_key,
            element_name: c.name || c.element_key,
            signature: { kind: "leyenda", token: c.symbol } as unknown as Json,
            times_confirmed: existing.times_confirmed + (corrected ? 0 : 1),
            times_corrected: existing.times_corrected + (corrected ? 1 : 0),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("takeoff_symbol_library").insert({
          organization_id: sheet.organization_id,
          scope: "org",
          system_type: systemType,
          sig_key: key,
          signature: { kind: "leyenda", token: c.symbol } as unknown as Json,
          element_key: c.element_key,
          element_name: c.name || c.element_key,
          times_confirmed: 1,
          times_corrected: 0,
        });
      }
    }

    // Contar con el diccionario confirmado.
    const { data: signed } = await supabase.storage
      .from("takeoff-temp")
      .createSignedUrl(sheet.pdf_path, 600);
    if (!signed?.signedUrl) return NextResponse.json({ error: "No se pudo firmar el PDF." }, { status: 500 });
    const job = await engineAnalyze(signed.signedUrl, systemType, engineSymbols);
    const result = await engineWaitResult(job.id);

    // Lectura de GLIFOS: los círculos que la geometría encontró pero no clasificó
    // por texto se leen con visión (una sola llamada sobre el mosaico de recortes)
    // y se clasifican por la leyenda confirmada. La geometría encuentra; la visión
    // solo lee la marca interna de lo ya encontrado.
    const glyphByPos = new Map<string, string>();
    const mosaic = result.glyph_mosaic;
    if (mosaic?.image_base64 && mosaic.cells?.length) {
      const gate = await gateAiRequest({
        organizationId: sheet.organization_id,
        userId: user.id,
        route: "takeoff-glifos",
        rateMs: 1500,
      });
      if (gate.ok) {
        try {
          const symMap = new Map<string, string>();
          for (const c of confirmed) if (c.symbol) symMap.set(c.symbol.toUpperCase(), c.element_key);
          const read = await readGlyphs(gate.apiKey, mosaic.image_base64);
          for (const [idx, letter] of Object.entries(read.letters)) {
            const cell = mosaic.cells[Number(idx)];
            if (!cell) continue;
            const key = symMap.get(clip(letter, 40).trim().toUpperCase());
            if (key && key !== "otro") glyphByPos.set(`${cell.x.toFixed(4)},${cell.y.toFixed(4)}`, key);
          }
          if (read.usage.input_tokens || read.usage.output_tokens) {
            await recordAiUsage({
              organizationId: sheet.organization_id,
              userId: user.id,
              projectId,
              route: "takeoff-glifos",
              model: LEGEND_MODEL,
              inputTokens: read.usage.input_tokens,
              outputTokens: read.usage.output_tokens,
            });
          }
        } catch {
          // Si la lectura de glifos falla, los círculos quedan sin_clasificar
          // (nunca se rompe el conteo por esto).
        }
      }
    }

    // Promoción de candidatos por tamaño ya aprendido (circulo|~N).
    const { data: libRows } = await supabase
      .from("takeoff_symbol_library")
      .select("sig_key, element_key")
      .eq("system_type", systemType)
      .in("scope", ["org", "global"]);
    const circleLib = new Map<number, string>();
    for (const r of libRows ?? []) {
      const m = /^circulo\|~(\d+)$/.exec(String(r.sig_key ?? ""));
      if (m && validKeys.has(r.element_key)) circleLib.set(Number(m[1]), r.element_key);
    }
    const promoted: { element_key: string; x: number; y: number; size: number | null }[] = [];
    const remainingCands: EngineCandidate[] = [];
    for (const c of result.candidates ?? []) {
      const learned =
        c.kind === "circulo" && typeof c.size === "number" ? circleLib.get(Math.round(c.size)) ?? null : null;
      if (learned) promoted.push({ element_key: learned, x: c.x, y: c.y, size: c.size });
      else remainingCands.push(c);
    }

    // Dedup: no reinsertar donde el humano ya corrigió (preserva su trabajo).
    const { data: kept } = await supabase
      .from("takeoff_detections")
      .select("x, y")
      .eq("sheet_id", sheetId)
      .in("status", ["reclasificado", "confirmado", "agregado_manual"]);
    const keptPts = (kept ?? []).map((k) => ({ x: Number(k.x), y: Number(k.y) }));
    const near = (x: number, y: number) =>
      keptPts.some((p) => Math.abs(p.x - x) < 0.008 && Math.abs(p.y - y) < 0.008);

    await supabase
      .from("takeoff_detections")
      .delete()
      .eq("sheet_id", sheetId)
      .eq("status", "detectado");

    const rows = [
      ...result.detections
        .filter((d) => !near(d.x, d.y))
        .map((d) => {
          const glyphKey =
            d.element_key === "detector_sin_clasificar"
              ? glyphByPos.get(`${d.x.toFixed(4)},${d.y.toFixed(4)}`)
              : undefined;
          return {
            organization_id: sheet.organization_id,
            sheet_id: sheetId,
            element_key: glyphKey ?? d.element_key,
            x: d.x,
            y: d.y,
            confidence: glyphKey ? "alta" : d.confidence,
            method: glyphKey ? "vision" : d.method,
            signature: (d.signature ?? null) as unknown as Json,
          };
        }),
      ...promoted
        .filter((p) => !near(p.x, p.y))
        .map((p) => ({
          organization_id: sheet.organization_id,
          sheet_id: sheetId,
          element_key: p.element_key,
          x: p.x,
          y: p.y,
          confidence: "alta",
          method: "biblioteca",
          signature: { kind: "circulo", token: null, size: p.size } as unknown as Json,
        })),
    ];
    if (rows.length) {
      const { error: detErr } = await supabase.from("takeoff_detections").insert(rows);
      if (detErr) return NextResponse.json({ error: "No se pudieron guardar las detecciones." }, { status: 500 });
    }

    await supabase
      .from("takeoff_sheets")
      .update({
        status: "en_verificacion",
        is_vector: result.is_vector,
        page_width: result.page_width,
        page_height: result.page_height,
        stats: result.stats as unknown as Json,
        candidates: remainingCands as unknown as Json,
        processed_at: new Date().toISOString(),
        job_error: null,
      })
      .eq("id", sheetId);

    return NextResponse.json({ done: true, detections: rows.length });
  } catch (err) {
    if (err instanceof EngineUnavailable) {
      return NextResponse.json({ error: "El motor de cálculo no está disponible." }, { status: 503 });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[takeoff] sheet-count falló", { sheetId, error: detail });
    return NextResponse.json({ error: `El conteo falló: ${clip(detail, 200)}` }, { status: 500 });
  }
}
