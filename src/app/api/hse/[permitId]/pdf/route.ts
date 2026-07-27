import { NextRequest, NextResponse } from "next/server";

import { TIPO_PERMISOS, type PermitTypeKey } from "@/lib/hse/permits";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "hse-evidence";

type PersonalRow = { nombre: string; cedula: string; firma_path: string | null };

// Genera el permiso de trabajo en PDF vía el motor Typst (Railway).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ permitId: string }> },
) {
  const { permitId } = await params;
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

  const { data: p } = await supabase
    .from("hse_permits")
    .select("*")
    .eq("id", permitId)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "Permiso no encontrado" }, { status: 404 });

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address, export_credit",
    )
    .eq("id", p.organization_id)
    .maybeSingle();

  const personal = (p.personal ?? []) as PersonalRow[];
  const paths = [
    p.emisor_firma_path,
    p.vigia_firma_path,
    ...personal.map((x) => x.firma_path),
  ].filter((x): x is string => !!x);
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, 900);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl) urlByPath.set(paths[i], s.signedUrl);
    });
  }
  const urlOf = (path: string | null) => (path ? (urlByPath.get(path) ?? "") : "");

  const rawLogo = org?.logo_url ?? "";
  const logoAbs = rawLogo
    ? rawLogo.startsWith("http")
      ? rawLogo
      : new URL(rawLogo, req.nextUrl.origin).toString()
    : "";

  const meta = TIPO_PERMISOS[p.permit_type as PermitTypeKey];
  const esAltura = meta?.grupo === "altura";

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
    permit: {
      titulo: meta?.titulo ?? "PERMISO DE TRABAJO",
      estado: p.estado,
      empresa: p.empresa ?? "",
      ciudad_lugar: p.ciudad_lugar ?? "",
      area_proceso: p.area_proceso ?? "",
      ubicacion: p.ubicacion ?? "",
      es_altura: esAltura,
      fecha: p.fecha ?? "",
      fecha_inicio: p.fecha_inicio ?? "",
      fecha_fin: p.fecha_fin ?? "",
      hora_inicio: p.hora_inicio ?? "",
      hora_fin: p.hora_fin ?? "",
      descripcion_tarea: p.descripcion_tarea ?? "",
      altura_estimada: p.altura_estimada ?? "",
      equipo_a_usar: p.equipo_a_usar ?? "",
      observaciones: p.observaciones ?? "",
    },
    personal: personal.map((x) => ({
      nombre: x.nombre ?? "",
      cedula: x.cedula ?? "",
      firma_url: urlOf(x.firma_path),
    })),
    checklist: p.checklist ?? [],
    emisor: {
      nombre: p.emisor_nombre ?? "",
      cedula: p.emisor_cedula ?? "",
      firma_url: urlOf(p.emisor_firma_path),
    },
    vigia: {
      nombre: p.vigia_nombre ?? "",
      cedula: p.vigia_cedula ?? "",
      firma_url: urlOf(p.vigia_firma_path),
    },
    filename: `Permiso_${(meta?.label ?? p.permit_type).replace(/[^\w-]+/g, "_")}`,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-permit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Secret": engineSecret,
      },
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
      "Content-Disposition": `attachment; filename="${payload.filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
