import { NextResponse } from "next/server";

import { elementsFor, legendDefaults } from "@/lib/takeoff/catalog";
import {
  engineAnalyze,
  engineWaitResult,
  EngineUnavailable,
  type EngineSymbol,
} from "@/lib/takeoff/engine-client";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

type LegendRow = { symbol?: string; element_key?: string; name?: string };

// Recuenta una hoja usando la leyenda CONFIRMADA/EDITADA por el ingeniero, sin
// re-leer la leyenda con visión ni re-renderizar (reutiliza el PDF en storage).
// No consume IA. Solo llama al motor de conteo.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { sheetId?: string; symbols?: LegendRow[] }
    | null;
  const sheetId = body?.sheetId;
  if (!sheetId) return NextResponse.json({ error: "Falta sheetId." }, { status: 400 });

  // RLS: solo devuelve la hoja si el usuario es miembro de su organización.
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
    return NextResponse.json(
      { error: "El PDF de la hoja ya no está disponible para recontar." },
      { status: 409 },
    );
  }

  const { data: analysisRow } = await supabase
    .from("takeoff_analyses")
    .select("system_type, system_id")
    .eq("id", sheet.analysis_id)
    .maybeSingle();
  if (!analysisRow) return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  const systemType = analysisRow.system_type;

  // Se restringe la leyenda al catálogo cerrado del sistema: cualquier clave
  // fuera del catálogo cae en 'otro'. Así el diccionario editado no puede
  // introducir tipos inválidos.
  const validKeys = new Set(elementsFor(systemType).map((e) => e.key));
  const edited: EngineSymbol[] = (Array.isArray(body?.symbols) ? body!.symbols : [])
    .map((e) => ({
      symbol: clip(e.symbol, 40),
      element_key: validKeys.has(String(e.element_key)) ? String(e.element_key) : "otro",
      name: clip(e.name, 120),
    }))
    .filter((e) => e.symbol);

  // Capa determinística SIEMPRE (P/R/V/G/ACI/E-x…), con las ediciones del
  // ingeniero por encima. El mapeo por letra es independiente del diccionario.
  const dict = new Map<string, EngineSymbol>();
  for (const d of legendDefaults(systemType)) dict.set(d.symbol.toUpperCase(), d);
  for (const s of edited) dict.set(s.symbol.toUpperCase(), s);
  const symbols = [...dict.values()];

  try {
    // URL firmada del PDF (sigue en el bucket temporal hasta aprobar).
    const { data: signed } = await supabase.storage
      .from("takeoff-temp")
      .createSignedUrl(sheet.pdf_path, 600);
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: "No se pudo firmar el PDF." }, { status: 500 });
    }

    // Motor: recuenta con la leyenda confirmada.
    const job = await engineAnalyze(signed.signedUrl, systemType, symbols);
    const result = await engineWaitResult(job.id);

    // Reemplaza SOLO las detecciones automáticas sin tocar (status 'detectado').
    // Se preservan las que el ingeniero ya confirmó, reclasificó, agregó o eliminó.
    await supabase
      .from("takeoff_detections")
      .delete()
      .eq("sheet_id", sheetId)
      .eq("status", "detectado");

    if (result.detections.length) {
      const rows = result.detections.map((d) => ({
        organization_id: sheet.organization_id,
        sheet_id: sheetId,
        element_key: d.element_key,
        x: d.x,
        y: d.y,
        confidence: d.confidence,
        method: d.method,
        signature: (d.signature ?? null) as unknown as Json,
      }));
      const { error: detErr } = await supabase.from("takeoff_detections").insert(rows);
      if (detErr) {
        return NextResponse.json(
          { error: "No se pudieron guardar las detecciones." },
          { status: 500 },
        );
      }
    }

    // Persiste la leyenda confirmada como diccionario oficial de la hoja Y del
    // sistema, para que el resto de las hojas reutilicen la versión corregida.
    await supabase
      .from("takeoff_sheets")
      .update({ legend: symbols as unknown as Json })
      .eq("id", sheetId);
    await supabase
      .from("takeoff_systems")
      .update({ legend: symbols as unknown as Json })
      .eq("id", analysisRow.system_id);

    return NextResponse.json({ done: true, detections: result.detections.length });
  } catch (err) {
    if (err instanceof EngineUnavailable) {
      return NextResponse.json(
        { error: "El motor de cálculo no está disponible." },
        { status: 503 },
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[takeoff] sheet-recount falló", { sheetId, error: detail });
    return NextResponse.json({ error: `El reconteo falló: ${clip(detail, 200)}` }, { status: 500 });
  }
}
