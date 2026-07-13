import { NextResponse } from "next/server";

import { elementsFor } from "@/lib/takeoff/catalog";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// ── Escritor BATCH-FIRST de correcciones del visor ──────────────────────────
// Único endpoint del que individual, propagación, lasso y (futuro) undo son
// consumidores. Recibe un arreglo de eventos append-only y por cada uno:
//   1) aplica el cambio a takeoff_detections,
//   2) APRENDE en symbol_library (la firma → el tipo corregido/confirmado),
//   3) registra el evento en takeoff_correction_events.
// Principio: cada interacción del usuario es dato de entrenamiento.

type Sig = { kind?: string; token?: string | null; size?: number | null } | null;

type InEvent = {
  action: "reclasificar" | "confirmar" | "eliminar" | "agregar";
  detectionId?: string;
  toKey?: string;
  // solo para "agregar":
  sheetId?: string;
  x?: number;
  y?: number;
  signature?: Sig;
};

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

// Clave de firma para matching en la biblioteca: kind|token (p.ej. circulo|P).
function sigKey(sig: Sig): string | null {
  if (!sig || !sig.kind) return null;
  return `${sig.kind}|${clip(sig.token ?? "", 40).toUpperCase()}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { events?: InEvent[] } | null;
  const events = Array.isArray(body?.events) ? body!.events : [];
  if (!events.length) return NextResponse.json({ error: "Sin eventos." }, { status: 400 });
  if (events.length > 2000) return NextResponse.json({ error: "Lote demasiado grande." }, { status: 400 });

  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Cache de (org, system_type) por hoja para no re-consultar.
  const sheetMeta = new Map<string, { org: string; systemType: string; nameByKey: Map<string, string> }>();
  async function metaForSheet(sheetId: string) {
    const cached = sheetMeta.get(sheetId);
    if (cached) return cached;
    const { data: sh } = await supabase
      .from("takeoff_sheets")
      .select("organization_id, analysis_id")
      .eq("id", sheetId)
      .maybeSingle();
    if (!sh) return null;
    const { data: an } = await supabase
      .from("takeoff_analyses")
      .select("system_type")
      .eq("id", sh.analysis_id)
      .maybeSingle();
    const systemType = an?.system_type ?? "alarma_incendio";
    const nameByKey = new Map(elementsFor(systemType).map((e) => [e.key, e.name]));
    const meta = { org: sh.organization_id, systemType, nameByKey };
    sheetMeta.set(sheetId, meta);
    return meta;
  }

  // Aprendizaje: registra/confirma una firma → tipo en la biblioteca (scope org).
  async function learn(
    org: string,
    systemType: string,
    nameByKey: Map<string, string>,
    sig: Sig,
    elementKey: string,
  ) {
    const key = sigKey(sig);
    if (!key || !elementKey || elementKey === "otro" || elementKey === "detector_sin_clasificar") return;
    const elementName = nameByKey.get(elementKey) ?? elementKey;
    const { data: existing } = await supabase
      .from("takeoff_symbol_library")
      .select("id, element_key, times_confirmed, times_corrected")
      .eq("organization_id", org)
      .eq("system_type", systemType)
      .eq("scope", "org")
      .eq("sig_key", key)
      .maybeSingle();
    if (existing) {
      const corrected = existing.element_key !== elementKey;
      await supabase
        .from("takeoff_symbol_library")
        .update({
          element_key: elementKey,
          element_name: elementName,
          signature: (sig ?? {}) as unknown as Json,
          times_confirmed: existing.times_confirmed + (corrected ? 0 : 1),
          times_corrected: existing.times_corrected + (corrected ? 1 : 0),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("takeoff_symbol_library").insert({
        organization_id: org,
        scope: "org",
        system_type: systemType,
        sig_key: key,
        signature: (sig ?? {}) as unknown as Json,
        element_key: elementKey,
        element_name: elementName,
        times_confirmed: 1,
        times_corrected: 0,
      });
    }
  }

  const logRows: Record<string, unknown>[] = [];
  let applied = 0;

  for (const ev of events) {
    try {
      if (ev.action === "agregar") {
        if (!ev.sheetId || typeof ev.x !== "number" || typeof ev.y !== "number" || !ev.toKey) continue;
        const meta = await metaForSheet(ev.sheetId);
        if (!meta) continue;
        const { data: ins } = await supabase
          .from("takeoff_detections")
          .insert({
            organization_id: meta.org,
            sheet_id: ev.sheetId,
            element_key: ev.toKey,
            x: ev.x,
            y: ev.y,
            confidence: "alta",
            method: "manual",
            status: "agregado_manual",
            signature: (ev.signature ?? null) as unknown as Json,
            reviewed_by: user.id,
            reviewed_at: now,
          })
          .select("id")
          .maybeSingle();
        await learn(meta.org, meta.systemType, meta.nameByKey, ev.signature ?? null, ev.toKey);
        logRows.push({
          organization_id: meta.org,
          sheet_id: ev.sheetId,
          detection_id: ins?.id ?? null,
          action: "agregar",
          from_key: null,
          to_key: ev.toKey,
          signature: (ev.signature ?? null) as unknown as Json,
          batch_id: batchId,
          created_by: user.id,
        });
        applied++;
        continue;
      }

      // reclasificar | confirmar | eliminar → operan sobre una detección existente
      if (!ev.detectionId) continue;
      const { data: det } = await supabase
        .from("takeoff_detections")
        .select("id, sheet_id, organization_id, element_key, signature")
        .eq("id", ev.detectionId)
        .maybeSingle();
      if (!det) continue;
      const meta = await metaForSheet(det.sheet_id);
      if (!meta) continue;
      const sig = det.signature as Sig;

      if (ev.action === "reclasificar") {
        if (!ev.toKey) continue;
        await supabase
          .from("takeoff_detections")
          .update({
            status: "reclasificado",
            element_key: ev.toKey,
            original_key: det.element_key,
            confidence: "alta",
            reviewed_by: user.id,
            reviewed_at: now,
          })
          .eq("id", det.id);
        await learn(meta.org, meta.systemType, meta.nameByKey, sig, ev.toKey);
        logRows.push({
          organization_id: meta.org,
          sheet_id: det.sheet_id,
          detection_id: det.id,
          action: "reclasificar",
          from_key: det.element_key,
          to_key: ev.toKey,
          signature: (sig ?? null) as unknown as Json,
          batch_id: batchId,
          created_by: user.id,
        });
        applied++;
      } else if (ev.action === "confirmar") {
        await supabase
          .from("takeoff_detections")
          .update({ status: "confirmado", confidence: "alta", reviewed_by: user.id, reviewed_at: now })
          .eq("id", det.id);
        await learn(meta.org, meta.systemType, meta.nameByKey, sig, det.element_key);
        logRows.push({
          organization_id: meta.org,
          sheet_id: det.sheet_id,
          detection_id: det.id,
          action: "confirmar",
          from_key: det.element_key,
          to_key: det.element_key,
          signature: (sig ?? null) as unknown as Json,
          batch_id: batchId,
          created_by: user.id,
        });
        applied++;
      } else if (ev.action === "eliminar") {
        await supabase
          .from("takeoff_detections")
          .update({ status: "eliminado", reviewed_by: user.id, reviewed_at: now })
          .eq("id", det.id);
        logRows.push({
          organization_id: meta.org,
          sheet_id: det.sheet_id,
          detection_id: det.id,
          action: "eliminar",
          from_key: det.element_key,
          to_key: null,
          signature: (sig ?? null) as unknown as Json,
          batch_id: batchId,
          created_by: user.id,
        });
        applied++;
      }
    } catch {
      // Un evento que falla no aborta el lote (append-only, tolerante).
      continue;
    }
  }

  if (logRows.length) {
    await supabase.from("takeoff_correction_events").insert(logRows as never);
  }

  return NextResponse.json({ ok: true, batchId, applied });
}
