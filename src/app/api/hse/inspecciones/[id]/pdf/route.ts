import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "hse-evidence";

const RIESGO_LABEL: Record<string, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  critico: "Crítico",
};
const RIESGO_COLOR: Record<string, string> = {
  bajo: "#15803D",
  medio: "#CA8A04",
  alto: "#E8A020",
  critico: "#DC2626",
};
const ESTADO_LABEL: Record<string, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
};

// Genera el reporte de inspección en PDF vía el motor Typst (Railway).
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

  const { data: ins } = await supabase
    .from("hse_inspecciones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!ins) return NextResponse.json({ error: "Inspección no encontrada" }, { status: 404 });

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address, export_credit",
    )
    .eq("id", ins.organization_id)
    .maybeSingle();

  const fotos = Array.isArray(ins.fotos) ? (ins.fotos as string[]) : [];
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
    ins: {
      riesgo_label: RIESGO_LABEL[ins.riesgo] ?? ins.riesgo,
      riesgo_color: RIESGO_COLOR[ins.riesgo] ?? "#CA8A04",
      estado_label: ESTADO_LABEL[ins.estado] ?? ins.estado,
      fecha: ins.fecha ?? "",
      ubicacion: ins.ubicacion ?? "",
      tipo_inspeccion: ins.tipo_inspeccion ?? "",
      hallazgo: ins.hallazgo ?? "",
      accion_requerida: ins.accion_requerida ?? "",
      responsable: ins.responsable ?? "",
      fecha_limite: ins.fecha_limite ?? "",
    },
    fotos: fotoUrls,
    filename: `Inspeccion_${(ins.tipo_inspeccion || "campo").replace(/[^\w-]+/g, "_")}_${ins.fecha}`,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-inspeccion`, {
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
