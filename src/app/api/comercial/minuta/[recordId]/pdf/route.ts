import { NextRequest, NextResponse } from "next/server";

import { toMinuta } from "@/lib/comercial/minuta";
import { createClient } from "@/lib/supabase/server";

// Genera la Minuta de visita (VT-F-003) en PDF editorial vía el motor Typst.
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

  // RLS: solo lo lee quien pertenece a la división del formato.
  const { data: rec } = await supabase
    .from("doc_records")
    .select("id, organization_id, format_id, record_label, data, created_by_name, created_at")
    .eq("id", recordId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const [{ data: format }, { data: org }] = await Promise.all([
    supabase
      .from("doc_formats")
      .select("code, version")
      .eq("id", rec.format_id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select(
        "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address, export_credit",
      )
      .eq("id", rec.organization_id)
      .maybeSingle(),
  ]);

  const d = toMinuta(rec.data);
  const participantes = d.participantes.filter(
    (p) => p.nombre.trim() || p.cargo.trim() || p.empresa.trim(),
  );
  const temas = d.temas_tratados.map((t) => t.trim()).filter(Boolean);
  const acuerdos = d.acuerdos.filter(
    (a) => a.descripcion.trim() || a.responsable.trim(),
  );

  const rawLogo = org?.logo_url ?? "";
  const logoAbs = rawLogo
    ? rawLogo.startsWith("http")
      ? rawLogo
      : new URL(rawLogo, req.nextUrl.origin).toString()
    : "";

  const elaboradoFecha = (rec.created_at ?? "").slice(0, 10);
  const safe = (s: string) => s.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = `Minuta_${safe(rec.record_label)}${d.cliente ? "_" + safe(d.cliente) : ""}`;

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
      codigo: format?.code ?? "VT-F-003",
      version: format?.version ?? "1",
      record_label: rec.record_label,
      cliente: d.cliente,
      contacto: d.contacto,
      cargo: d.cargo,
      fecha_visita: d.fecha_visita,
      tema_reunion: d.tema_reunion,
      proxima_reunion: d.proxima_reunion,
      observaciones: d.observaciones,
      elaborado_por: rec.created_by_name,
      elaborado_fecha: elaboradoFecha,
    },
    participantes,
    temas,
    acuerdos,
    filename,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-minuta`, {
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
