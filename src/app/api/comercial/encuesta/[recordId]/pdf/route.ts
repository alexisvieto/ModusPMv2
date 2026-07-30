import { NextRequest, NextResponse } from "next/server";

import { ENCUESTA_TIPOS, encuestaDef, optLabel } from "@/lib/comercial/encuesta";
import { createClient } from "@/lib/supabase/server";

// Genera la encuesta de satisfacción respondida (VT-F-002) en PDF editorial.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await params;
  const engineUrl = process.env.SURVEY_ENGINE_URL;
  const engineSecret = process.env.SURVEY_ENGINE_SECRET;
  if (!engineUrl || !engineSecret) {
    return NextResponse.json(
      { error: "El motor de PDF no está configurado (SURVEY_ENGINE_URL / SURVEY_ENGINE_SECRET)." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: rec } = await supabase
    .from("doc_records")
    .select("id, organization_id, format_id, record_label, data, answered_at")
    .eq("id", recordId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const [{ data: format }, { data: org }] = await Promise.all([
    supabase.from("doc_formats").select("code, version").eq("id", rec.format_id).maybeSingle(),
    supabase
      .from("organizations")
      .select("name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, export_credit")
      .eq("id", rec.organization_id)
      .maybeSingle(),
  ]);

  const d = (rec.data ?? {}) as {
    cliente?: string;
    referencia?: string;
    tipo?: string;
    respuestas?: Record<string, string>;
    comentarios?: string;
  };
  const tipo = d.tipo ?? "suministro";
  const def = encuestaDef(tipo);
  const respuestas = d.respuestas ?? {};

  const secciones = def.secciones.map((sec) => ({
    titulo: sec.titulo,
    items: sec.preguntas.map((q) => ({
      pregunta: q.label,
      respuesta: optLabel(q.id, respuestas[q.id] ?? ""),
    })),
  }));

  const rawLogo = org?.logo_url ?? "";
  const logoAbs = rawLogo
    ? rawLogo.startsWith("http")
      ? rawLogo
      : new URL(rawLogo, req.nextUrl.origin).toString()
    : "";

  const safe = (x: string) => x.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = `Encuesta_${safe(rec.record_label)}${d.cliente ? "_" + safe(d.cliente) : ""}`;

  const payload = {
    brand: {
      name: org?.name ?? "",
      legal_name: org?.legal_name ?? org?.name ?? "",
      primary: org?.brand_primary ?? "#0F2044",
      accent: org?.brand_accent ?? "#E8A020",
      dark: org?.brand_dark ?? "#0F2044",
      website: org?.website ?? "",
      logo_url: logoAbs,
      credit: org?.export_credit ?? true,
    },
    e: {
      codigo: format?.code ?? "VT-F-002",
      version: format?.version ?? "1",
      record_label: rec.record_label,
      tipo_label: ENCUESTA_TIPOS.find((t) => t.v === tipo)?.l ?? "",
      cliente: d.cliente ?? "",
      referencia: d.referencia ?? "",
      ref_label: def.refLabel,
      comentarios: def.comentarios ? (d.comentarios ?? "") : "",
      answered_fecha: (rec.answered_at ?? "").slice(0, 10),
    },
    secciones,
    filename,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-encuesta`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Engine-Secret": engineSecret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "El motor de PDF no respondió a tiempo." : "No se pudo contactar el motor de PDF." },
      { status: timedOut ? 504 : 502 },
    );
  }
  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 500);
    return NextResponse.json({ error: "Fallo al generar el PDF.", detail }, { status: 502 });
  }

  const buf = await resp.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
