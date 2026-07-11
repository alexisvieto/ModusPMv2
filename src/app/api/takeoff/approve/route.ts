import { NextResponse } from "next/server";

import { elementsFor } from "@/lib/takeoff/catalog";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const ACTIVE = ["detectado", "confirmado", "reclasificado", "agregado_manual"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { analysisId?: string } | null;
  const analysisId = body?.analysisId;
  if (!analysisId)
    return NextResponse.json({ error: "Falta analysisId." }, { status: 400 });

  // RLS: solo miembros de la org ven/actualizan este análisis.
  const { data: analysis } = await supabase
    .from("takeoff_analyses")
    .select("*")
    .eq("id", analysisId)
    .maybeSingle();
  if (!analysis)
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });

  const { data: sheets } = await supabase
    .from("takeoff_sheets")
    .select("id, pdf_path, snapshot_path")
    .eq("analysis_id", analysisId);
  const sheetIds = (sheets ?? []).map((s) => s.id);
  if (!sheetIds.length)
    return NextResponse.json({ error: "El análisis no tiene hojas." }, { status: 400 });

  // ── Consolidar detecciones vivas → cantidades por elemento ──
  const { data: detections } = await supabase
    .from("takeoff_detections")
    .select("element_key, status")
    .in("sheet_id", sheetIds);
  const counts = new Map<string, number>();
  for (const d of detections ?? []) {
    if (!ACTIVE.includes(d.status)) continue;
    counts.set(d.element_key, (counts.get(d.element_key) ?? 0) + 1);
  }

  const elByKey = new Map(elementsFor(analysis.system_type).map((e) => [e.key, e]));
  const results = [...counts.entries()].map(([key, qty]) => {
    const el = elByKey.get(key);
    return {
      organization_id: analysis.organization_id,
      analysis_id: analysisId,
      element_key: key,
      element_name: el?.name ?? key,
      unit: el?.unit ?? "und",
      qty_detected: qty,
      qty_final: qty, // tras verificación humana = el conteo vivo actual
    };
  });

  if (results.length) {
    const { error: resErr } = await supabase
      .from("takeoff_results")
      .upsert(results, { onConflict: "analysis_id,element_key" });
    if (resErr)
      return NextResponse.json(
        { error: "No se pudieron consolidar los resultados." },
        { status: 500 },
      );
  }

  // ── Storage efímero: mover la evidencia (imagen) a bucket permanente y
  // borrar los PDF. Las detecciones se conservan (permiten regenerar overlay). ──
  const toRemove: string[] = [];
  for (const s of sheets ?? []) {
    if (s.snapshot_path) {
      const { data: img } = await supabase.storage
        .from("takeoff-temp")
        .download(s.snapshot_path);
      if (img) {
        const evPath = s.snapshot_path; // mismo prefijo org; bucket distinto
        await supabase.storage
          .from("takeoff-evidence")
          .upload(evPath, img, { contentType: "image/jpeg", upsert: true });
        await supabase
          .from("takeoff_sheets")
          .update({ snapshot_path: evPath, status: "aprobada", pdf_path: null })
          .eq("id", s.id);
        toRemove.push(s.snapshot_path);
      }
    }
    if (s.pdf_path) toRemove.push(s.pdf_path);
  }
  if (toRemove.length) await supabase.storage.from("takeoff-temp").remove(toRemove);

  await supabase
    .from("takeoff_analyses")
    .update({
      status: "aprobado",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", analysisId);

  return NextResponse.json({ ok: true, results: results.length });
}
