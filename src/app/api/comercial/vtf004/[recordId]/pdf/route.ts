import { NextRequest, NextResponse } from "next/server";

import { toVtF004 } from "@/lib/comercial/vtf004";
import { createClient } from "@/lib/supabase/server";

const FREC: Record<string, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

// Genera la Visita Técnica (VT-F-004) en PDF editorial vía el motor Typst.
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
    .select("id, organization_id, format_id, record_label, data, created_by_name, created_at")
    .eq("id", recordId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const [{ data: format }, { data: org }] = await Promise.all([
    supabase.from("doc_formats").select("code, version").eq("id", rec.format_id).maybeSingle(),
    supabase
      .from("organizations")
      .select(
        "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address, export_credit",
      )
      .eq("id", rec.organization_id)
      .maybeSingle(),
  ]);

  const d = toVtF004(rec.data);
  const personalIngesoft = d.personal_ingesoft.filter((p) => p.nombre.trim() || p.cargo.trim());
  const personalCliente = d.personal_cliente.filter((p) => p.nombre.trim() || p.cargo.trim());
  const temas = d.temas.filter((t) => t.punto.trim() || t.responsable.trim() || t.fecha.trim());

  let frecuenciaLabel = "";
  if (d.frecuencia === "otros") {
    frecuenciaLabel = d.frecuencia_otros.trim() ? `Otros: ${d.frecuencia_otros.trim()}` : "Otros";
  } else if (d.frecuencia) {
    frecuenciaLabel = FREC[d.frecuencia] ?? d.frecuencia;
  }

  const rawLogo = org?.logo_url ?? "";
  const logoAbs = rawLogo
    ? rawLogo.startsWith("http")
      ? rawLogo
      : new URL(rawLogo, req.nextUrl.origin).toString()
    : "";

  const elaboradoFecha = (rec.created_at ?? "").slice(0, 10);
  const safe = (s: string) => s.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = `VisitaTecnica_${safe(rec.record_label)}${d.cliente ? "_" + safe(d.cliente) : ""}`;

  const payload = {
    brand: {
      name: org?.name ?? "",
      legal_name: org?.legal_name ?? org?.name ?? "",
      primary: org?.brand_primary ?? "#0F2044",
      accent: org?.brand_accent ?? "#E8A020",
      dark: org?.brand_dark ?? "#0F2044",
      website: org?.website ?? "",
      email: org?.contact_email ?? "",
      phone: org?.contact_phone ?? "",
      address: org?.address ?? "",
      logo_url: logoAbs,
      credit: org?.export_credit ?? true,
    },
    m: {
      codigo: format?.code ?? "VT-F-004",
      version: format?.version ?? "01",
      record_label: rec.record_label,
      cliente: d.cliente,
      fecha: d.fecha,
      objetivos: d.objetivos,
      frecuencia_label: frecuenciaLabel,
      obs_estructurales: d.obs_estructurales,
      obs_tecnicas: d.obs_tecnicas,
      obs_condiciones: d.obs_condiciones,
      obs_otras: d.obs_otras,
      elaborado_por: rec.created_by_name,
      elaborado_fecha: elaboradoFecha,
    },
    personal_ingesoft: personalIngesoft,
    personal_cliente: personalCliente,
    temas,
    filename,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-vtf004`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Engine-Secret": engineSecret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
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
