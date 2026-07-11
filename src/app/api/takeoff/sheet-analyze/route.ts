import { NextResponse } from "next/server";

import { gateAiRequest, recordAiUsage } from "@/lib/ai/tenant";
import {
  analyzeSheetPdf,
  DEFAULT_PARAMS,
  type EngineParams,
} from "@/lib/takeoff/engine";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const LEGEND_MODEL = "claude-opus-4-8";

/** Carga los params de calibración del sistema: org sobreescribe global. */
async function loadCalibration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  systemType: string,
): Promise<EngineParams> {
  const { data } = await supabase
    .from("takeoff_calibration")
    .select("scope, params")
    .eq("system_type", systemType)
    .or(`scope.eq.global,organization_id.eq.${organizationId}`);
  const asObj = (p: unknown): Partial<EngineParams> =>
    p && typeof p === "object" && !Array.isArray(p) ? (p as Partial<EngineParams>) : {};
  const org = data?.find((r) => r.scope === "org");
  const global = data?.find((r) => r.scope === "global");
  return { ...DEFAULT_PARAMS, ...asObj(global?.params), ...asObj(org?.params) };
}

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
  if (sheet.status === "en_verificacion" || sheet.status === "aprobada") {
    return NextResponse.json({ done: true });
  }

  // El análisis y su proyecto (las FK compuestas rompen el embed anidado).
  const { data: analysisRow } = await supabase
    .from("takeoff_analyses")
    .select("system_type, system_id")
    .eq("id", sheet.analysis_id)
    .maybeSingle();
  const { data: sysRow } = analysisRow
    ? await supabase
        .from("takeoff_systems")
        .select("project_id")
        .eq("id", analysisRow.system_id)
        .maybeSingle()
    : { data: null };
  if (!analysisRow || !sysRow) {
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  }
  const systemType = analysisRow.system_type;
  const projectId = sysRow.project_id;

  const gate = await gateAiRequest({
    organizationId: sheet.organization_id,
    userId: user.id,
    route: "takeoff-plano",
    rateMs: 1500,
  });
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const fail = async (msg: string) => {
    await supabase
      .from("takeoff_sheets")
      .update({ status: "error", job_error: msg })
      .eq("id", sheetId);
    return NextResponse.json({ error: msg }, { status: 500 });
  };

  try {
    await supabase.from("takeoff_sheets").update({ status: "procesando" }).eq("id", sheetId);

    if (!sheet.pdf_path) return await fail("El PDF de la hoja ya no está disponible.");
    const { data: file } = await supabase.storage.from("takeoff-temp").download(sheet.pdf_path);
    if (!file) return await fail("No se pudo leer el PDF de la hoja.");
    const bytes = new Uint8Array(await file.arrayBuffer());

    const params = await loadCalibration(supabase, sheet.organization_id, systemType);

    // ── El motor: pdf → JSON (extracción + leyenda + conteo). Sin UI. ──
    const result = await analyzeSheetPdf(bytes, {
      systemType,
      apiKey: gate.apiKey,
      params,
    });

    // Registrar el uso de IA de la lectura de leyenda.
    if (result.usage.input_tokens || result.usage.output_tokens) {
      await recordAiUsage({
        organizationId: sheet.organization_id,
        userId: user.id,
        projectId,
        route: "takeoff-plano",
        model: LEGEND_MODEL,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
      });
    }

    // Imagen del plano para el visor (se mueve a evidence al aprobar).
    const imgPath = `${sheet.organization_id}/${projectId}/sheets/${sheetId}.jpg`;
    await supabase.storage
      .from("takeoff-temp")
      .upload(imgPath, Buffer.from(result.imageBase64, "base64"), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (result.detections.length) {
      const rows = result.detections.map((d) => ({
        organization_id: sheet.organization_id,
        sheet_id: sheetId,
        element_key: d.element_key,
        x: d.x,
        y: d.y,
        confidence: d.confidence,
        method: d.method,
      }));
      const { error: detErr } = await supabase.from("takeoff_detections").insert(rows);
      if (detErr) return await fail("No se pudieron guardar las detecciones.");
    }

    await supabase
      .from("takeoff_sheets")
      .update({
        status: "en_verificacion",
        is_vector: result.isVector,
        page_width: result.pageWidth,
        page_height: result.pageHeight,
        legend: result.legend as unknown as Json,
        snapshot_path: imgPath,
        processed_at: new Date().toISOString(),
        job_error: null,
      })
      .eq("id", sheetId);

    return NextResponse.json({
      done: true,
      detections: result.detections.length,
      legend: result.legend.length,
      isVector: result.isVector,
    });
  } catch (err) {
    console.error("[takeoff] sheet-analyze falló", {
      sheetId,
      error: err instanceof Error ? err.message : String(err),
    });
    return await fail("El análisis de la hoja falló. Puedes reintentarlo.");
  }
}
