import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "survey-evidence";

// Genera el reporte PDF del survey vía el motor Typst (Railway) y lo devuelve
// para descarga. Auth: sesión del usuario (RLS restringe a su organización).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  const { surveyId } = await params;
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

  const { data: s } = await supabase
    .from("survey_surveys")
    .select(
      "id, organization_id, client_name, project_name, odoo_code, site_location, survey_date, engineer_name, notes, status",
    )
    .eq("id", surveyId)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: "Survey no encontrado" }, { status: 404 });

  const [{ data: contacts }, { data: findings }, { data: photos }, { data: signatures }, { data: org }] =
    await Promise.all([
      supabase
        .from("survey_contacts")
        .select("name, role, phone, email, notes")
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_findings")
        .select("title, description, severity")
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_photos")
        .select("caption, storage_path")
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_signatures")
        .select("signer_name, signer_role, signed_at, storage_path")
        .eq("survey_id", surveyId)
        .order("signed_at", { ascending: true }),
      supabase
        .from("organizations")
        .select(
          "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address, export_credit",
        )
        .eq("id", s.organization_id)
        .maybeSingle(),
    ]);

  // URLs firmadas para que el motor pueda descargar las imágenes.
  const photoPaths = (photos ?? []).map((p) => p.storage_path);
  const sigPaths = (signatures ?? []).map((x) => x.storage_path);
  const [photoUrls, sigUrls] = await Promise.all([
    photoPaths.length
      ? supabase.storage.from(BUCKET).createSignedUrls(photoPaths, 900)
      : Promise.resolve({ data: [] as { signedUrl: string }[] }),
    sigPaths.length
      ? supabase.storage.from(BUCKET).createSignedUrls(sigPaths, 900)
      : Promise.resolve({ data: [] as { signedUrl: string }[] }),
  ]);

  // Logo: si es ruta relativa ("/x.png") se vuelve absoluta con el origen del app.
  const rawLogo = org?.logo_url ?? "";
  const logoAbs = rawLogo
    ? rawLogo.startsWith("http")
      ? rawLogo
      : new URL(rawLogo, req.nextUrl.origin).toString()
    : "";

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-PA", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  const payload = {
    brand: {
      name: org?.name ?? "",
      legal_name: org?.legal_name ?? org?.name ?? "",
      primary: org?.brand_primary ?? "#F79A02",
      accent: org?.brand_accent ?? "#F8BA00",
      dark: org?.brand_dark ?? "#2D2D2D",
      website: org?.website ?? "",
      email: org?.contact_email ?? "",
      phone: org?.contact_phone ?? "",
      address: org?.address ?? "",
      logo_url: logoAbs,
      credit: org?.export_credit ?? true,
    },
    survey: {
      client: s.client_name ?? "",
      project: s.project_name ?? "",
      odoo_code: s.odoo_code ?? "",
      site: s.site_location ?? "",
      date: s.survey_date ?? "",
      engineer: s.engineer_name ?? "",
      notes: s.notes ?? "",
      status: s.status ?? "borrador",
    },
    contacts: (contacts ?? []).map((c) => ({
      name: c.name ?? "",
      role: c.role ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      notes: c.notes ?? "",
    })),
    findings: (findings ?? []).map((f) => ({
      title: f.title ?? "",
      description: f.description ?? "",
      severity: f.severity ?? "media",
    })),
    photos: (photos ?? []).map((p, i) => ({
      url: (photoUrls.data ?? [])[i]?.signedUrl ?? "",
      caption: p.caption ?? "",
    })),
    signatures: (signatures ?? []).map((x, i) => ({
      signer_name: x.signer_name,
      signer_role: x.signer_role ?? "",
      signed_at: fmtDate(x.signed_at),
      url: (sigUrls.data ?? [])[i]?.signedUrl ?? "",
    })),
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Secret": engineSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar el motor de PDF." }, { status: 502 });
  }
  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 500);
    return NextResponse.json({ error: "Fallo al generar el PDF.", detail }, { status: 502 });
  }

  const buf = await resp.arrayBuffer();
  const safe = (s.client_name || "survey").replace(/[^\w-]+/g, "_");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Reporte_Site_Survey_${safe}_${s.survey_date}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
