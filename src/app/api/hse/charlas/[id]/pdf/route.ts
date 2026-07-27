import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "hse-evidence";

// Genera el acta de charla en PDF (con lista de asistencia firmada) vía el motor Typst.
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

  const { data: charla } = await supabase
    .from("hse_charlas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!charla) return NextResponse.json({ error: "Charla no encontrada" }, { status: 404 });

  const [{ data: org }, { data: asis }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address, export_credit",
      )
      .eq("id", charla.organization_id)
      .maybeSingle(),
    supabase
      .from("hse_charla_asistencias")
      .select("empleado_id, firma_path")
      .eq("charla_id", id),
  ]);

  // Nombres y cargos de los asistentes.
  const empIds = (asis ?? []).map((a) => a.empleado_id);
  const empById = new Map<string, { nombre: string; cargo: string }>();
  if (empIds.length) {
    const { data: emps } = await supabase
      .from("hse_empleados")
      .select("id, nombre, cargo")
      .in("id", empIds);
    (emps ?? []).forEach((e) => empById.set(e.id, { nombre: e.nombre, cargo: e.cargo ?? "" }));
  }

  // Firmas firmadas.
  const paths = (asis ?? []).map((a) => a.firma_path).filter((p): p is string => !!p);
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 900);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl) urlByPath.set(paths[i], s.signedUrl);
    });
  }

  const asistentes = (asis ?? []).map((a) => {
    const emp = empById.get(a.empleado_id);
    return {
      nombre: emp?.nombre ?? "—",
      cargo: emp?.cargo ?? "",
      firma_url: a.firma_path ? (urlByPath.get(a.firma_path) ?? "") : "",
    };
  });

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
    charla: {
      titulo: charla.titulo ?? "",
      fecha: charla.fecha ?? "",
      hora_inicio: charla.hora_inicio ?? "",
      duracion_min: charla.duracion_min != null ? String(charla.duracion_min) : "",
      lugar: charla.lugar ?? "",
      facilitador: charla.facilitador ?? "",
      descripcion: charla.descripcion ?? "",
    },
    asistentes,
    filename: `Acta_Charla_${(charla.titulo || "seguridad").replace(/[^\w-]+/g, "_")}_${charla.fecha}`,
  };

  let resp: Response;
  try {
    resp = await fetch(`${engineUrl.replace(/\/$/, "")}/render-charla`, {
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
