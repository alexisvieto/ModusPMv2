import { NextRequest, NextResponse } from "next/server";

import { siteSurveyPhotoPaths, toSiteSurvey } from "@/lib/operaciones/site-survey";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "survey-evidence";

// Genera el Site Survey (PY-F-014) en PDF editorial vía el motor Typst.
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

  const d = toSiteSurvey(rec.data);

  // Firmar todas las fotos y armar mapa path -> URL.
  const paths = siteSurveyPhotoPaths(d);
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 900);
    for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }
  const toRefs = (arr: { path: string; caption: string }[]) =>
    arr
      .map((p) => ({ url: urlByPath.get(p.path) ?? "", caption: p.caption }))
      .filter((r) => r.url);

  const rawLogo = org?.logo_url ?? "";
  const logoAbs = rawLogo
    ? rawLogo.startsWith("http")
      ? rawLogo
      : new URL(rawLogo, req.nextUrl.origin).toString()
    : "";

  const elaboradoFecha = (rec.created_at ?? "").slice(0, 10);
  const safe = (x: string) => x.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = `SiteSurvey_${safe(rec.record_label)}${d.cliente ? "_" + safe(d.cliente) : ""}`;

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
    s: {
      codigo_formato: format?.code ?? "PY-F-014",
      version: format?.version ?? "1",
      record_label: rec.record_label,
      objeto_licitacion: d.objeto_licitacion,
      codigo: d.codigo,
      cliente: d.cliente,
      alcance: d.alcance,
      precio_referencia: d.precio_referencia,
      coord_lat: d.coord_lat,
      coord_lng: d.coord_lng,
      encargado: d.encargado,
      tipo_zona: d.tipo_zona,
      facilidades: d.facilidades,
      acceso: d.acceso,
      relieve: d.relieve,
      info_general: d.info_general,
      elaborado_por: rec.created_by_name,
      elaborado_fecha: elaboradoFecha,
    },
    fotos_sitio: toRefs(d.fotos_sitio),
    fotos_tecnicas: toRefs(d.fotos_tecnicas),
    filename,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-sitesurvey`, {
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
