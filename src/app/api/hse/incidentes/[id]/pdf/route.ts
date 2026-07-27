import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "hse-evidence";

const TIPO_LABEL: Record<string, string> = {
  accidente: "Accidente",
  incidente: "Incidente",
  cuasi_accidente: "Cuasi-accidente",
};
const SEV_LABEL: Record<string, string> = {
  leve: "Leve",
  moderado: "Moderado",
  grave: "Grave",
  fatal: "Fatal",
};
const SEV_COLOR: Record<string, string> = {
  leve: "#15803D",
  moderado: "#CA8A04",
  grave: "#E8A020",
  fatal: "#DC2626",
};
const ESTADO_LABEL: Record<string, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
};

// Genera el reporte de incidente en PDF vía el motor Typst (Railway).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: inc } = await supabase
    .from("hse_incidentes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!inc) return NextResponse.json({ error: "Incidente no encontrado" }, { status: 404 });

  const [{ data: org }, afectadoRes] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address, export_credit",
      )
      .eq("id", inc.organization_id)
      .maybeSingle(),
    inc.empleado_afectado
      ? supabase.from("hse_empleados").select("nombre").eq("id", inc.empleado_afectado).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const fotos = Array.isArray(inc.fotos) ? (inc.fotos as string[]) : [];
  const fotoUrls: { url: string }[] = [];
  if (fotos.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(fotos, 900);
    (signed ?? []).forEach((s) => {
      if (s.signedUrl) fotoUrls.push({ url: s.signedUrl });
    });
  }

  const rawLogo = org?.logo_url ?? "";
  const logoAbs = rawLogo
    ? rawLogo.startsWith("http")
      ? rawLogo
      : new URL(rawLogo, req.nextUrl.origin).toString()
    : "";

  const tipoLabel = TIPO_LABEL[inc.tipo_evento] ?? inc.tipo_evento;

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
    inc: {
      tipo_label: tipoLabel,
      severidad_label: SEV_LABEL[inc.severidad] ?? inc.severidad,
      severidad_color: SEV_COLOR[inc.severidad] ?? "#15803D",
      estado_label: ESTADO_LABEL[inc.estado] ?? inc.estado,
      fecha: inc.fecha_evento ?? "",
      hora: inc.hora_evento ?? "",
      ubicacion: inc.ubicacion ?? "",
      descripcion: inc.descripcion ?? "",
      causa_raiz: inc.causa_raiz ?? "",
      accion_correctiva: inc.accion_correctiva ?? "",
      afectado_nombre: afectadoRes.data?.nombre ?? "",
      dias_perdidos: inc.dias_perdidos ?? 0,
      atencion_medica: inc.requirio_atencion_medica ?? false,
    },
    fotos: fotoUrls,
    filename: `Incidente_${tipoLabel.replace(/[^\w-]+/g, "_")}_${inc.fecha_evento}`,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-incidente`, {
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
      "Content-Disposition": `attachment; filename="${payload.filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
