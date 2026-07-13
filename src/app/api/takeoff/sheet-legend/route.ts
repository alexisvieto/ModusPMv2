import { NextResponse } from "next/server";

import { gateAiRequest, recordAiUsage } from "@/lib/ai/tenant";
import { elementsFor, legendDefaults } from "@/lib/takeoff/catalog";
import {
  engineLegend,
  engineRender,
  EngineUnavailable,
} from "@/lib/takeoff/engine-client";
import { LEGEND_MODEL, readLegend } from "@/lib/takeoff/legend-vision";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// Fila propuesta del diccionario, con el ORIGEN de la sugerencia para que el
// usuario sepa qué confirmar. source: vision | biblioteca | sugerencia.
type Row = { symbol: string; element_key: string; name: string; source: string };

const MIN_LEGEND_ROWS = 5;
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

// ── FASE 1: el motor PROPONE el diccionario de la leyenda. NO cuenta. ────────
// Combina: leyenda leída por visión (this plano) + symbol_library (aprendido) +
// convenciones del catálogo (sugerencias). Todo queda para que el usuario lo
// confirme/corrija antes de contar. Nada se cuenta sobre un diccionario sin
// confirmar.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { sheetId?: string } | null;
  const sheetId = body?.sheetId;
  if (!sheetId) return NextResponse.json({ error: "Falta sheetId." }, { status: 400 });

  const { data: sheet } = await supabase
    .from("takeoff_sheets")
    .select("*")
    .eq("id", sheetId)
    .maybeSingle();
  if (!sheet) return NextResponse.json({ error: "Hoja no encontrada." }, { status: 404 });
  if (sheet.status === "leyenda" || sheet.status === "en_verificacion" || sheet.status === "aprobada") {
    return NextResponse.json({ done: true });
  }

  const { data: analysisRow } = await supabase
    .from("takeoff_analyses")
    .select("system_type, system_id")
    .eq("id", sheet.analysis_id)
    .maybeSingle();
  const { data: sysRow } = analysisRow
    ? await supabase
        .from("takeoff_systems")
        .select("project_id, legend")
        .eq("id", analysisRow.system_id)
        .maybeSingle()
    : { data: null };
  if (!analysisRow || !sysRow) {
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  }
  const systemType = analysisRow.system_type;
  const projectId = sysRow.project_id;
  const validKeys = new Set(elementsFor(systemType).map((e) => e.key));

  const gate = await gateAiRequest({
    organizationId: sheet.organization_id,
    userId: user.id,
    route: "takeoff-plano",
    rateMs: 1500,
  });
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const fail = async (msg: string) => {
    await supabase.from("takeoff_sheets").update({ status: "error", job_error: msg }).eq("id", sheetId);
    return NextResponse.json({ error: msg }, { status: 500 });
  };

  let phase = "inicio";
  try {
    await supabase.from("takeoff_sheets").update({ status: "procesando" }).eq("id", sheetId);
    if (!sheet.pdf_path) return await fail("El PDF de la hoja ya no está disponible.");

    phase = "url-firmada";
    const { data: signed } = await supabase.storage
      .from("takeoff-temp")
      .createSignedUrl(sheet.pdf_path, 600);
    if (!signed?.signedUrl) return await fail("No se pudo firmar el PDF.");
    const pdfUrl = signed.signedUrl;

    // 1) Visión lee la leyenda del PLANO (sin sesgo de convenciones).
    phase = "leyenda";
    const legend = await engineLegend(pdfUrl, systemType);
    let visionSymbols: { symbol: string; element_key: string; name: string }[] = [];
    if (legend.found && legend.image_base64) {
      phase = "vision-leyenda";
      let read = await readLegend(gate.apiKey, legend.image_base64, systemType);
      let inTok = read.usage.input_tokens;
      let outTok = read.usage.output_tokens;
      if (read.symbols.length < MIN_LEGEND_ROWS) {
        const retry = await readLegend(gate.apiKey, legend.image_base64, systemType, true);
        inTok += retry.usage.input_tokens;
        outTok += retry.usage.output_tokens;
        if (retry.symbols.length > read.symbols.length) read = retry;
      }
      visionSymbols = read.symbols;
      if (inTok || outTok) {
        await recordAiUsage({
          organizationId: sheet.organization_id,
          userId: user.id,
          projectId,
          route: "takeoff-plano",
          model: LEGEND_MODEL,
          inputTokens: inTok,
          outputTokens: outTok,
        });
      }
    }

    // 2) Imagen del plano completo para el visor.
    phase = "render";
    const render = await engineRender(pdfUrl);
    const imgPath = `${sheet.organization_id}/${projectId}/sheets/${sheetId}.jpg`;
    phase = "guardar-imagen";
    const upImg = await supabase.storage
      .from("takeoff-temp")
      .upload(imgPath, Buffer.from(render.image_base64, "base64"), {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (upImg.error) return await fail(`No se pudo guardar la imagen del plano: ${upImg.error.message}`);

    // 3) Diccionario PROPUESTO (todo editable en la confirmación):
    //    convenciones (sugerencia) → biblioteca (aprendido) → visión (este plano).
    const dict = new Map<string, Row>();
    for (const d of legendDefaults(systemType)) {
      dict.set(d.symbol.toUpperCase(), { symbol: d.symbol, element_key: d.element_key, name: d.name, source: "sugerencia" });
    }
    const { data: libRows } = await supabase
      .from("takeoff_symbol_library")
      .select("sig_key, element_key, element_name")
      .eq("system_type", systemType)
      .in("scope", ["org", "global"]);
    for (const r of libRows ?? []) {
      const m = /^leyenda\|(.+)$/.exec(String(r.sig_key ?? ""));
      if (!m || !validKeys.has(r.element_key)) continue;
      dict.set(m[1].toUpperCase(), { symbol: m[1], element_key: r.element_key, name: r.element_name ?? r.element_key, source: "biblioteca" });
    }
    for (const s of visionSymbols) {
      if (!s.symbol) continue;
      dict.set(s.symbol.toUpperCase(), { symbol: clip(s.symbol, 40), element_key: s.element_key, name: clip(s.name, 120), source: "vision" });
    }
    const proposal = [...dict.values()];

    const readOk = visionSymbols.filter((s) => s.symbol && s.element_key !== "otro").length >= 3;
    await supabase
      .from("takeoff_sheets")
      .update({
        status: "leyenda",
        legend: proposal as unknown as Json,
        snapshot_path: imgPath,
        is_vector: render ? true : sheet.is_vector,
        page_width: render.page_width,
        page_height: render.page_height,
        job_error: readOk
          ? null
          : "La visión no pudo leer bien la leyenda. Revisá y completá la simbología a mano antes de contar.",
      })
      .eq("id", sheetId);

    return NextResponse.json({ done: true, proposed: proposal.length, readOk });
  } catch (err) {
    if (err instanceof EngineUnavailable) {
      return await fail("El motor de cálculo no está disponible aún.");
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[takeoff] sheet-legend falló", { sheetId, phase, error: detail });
    return await fail(`Falló en «${phase}»: ${clip(detail, 240)}`);
  }
}
