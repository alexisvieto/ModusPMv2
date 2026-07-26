import { notFound } from "next/navigation";

import { SurveyEditor } from "@/components/survey/survey-editor";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "survey-evidence";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("survey_surveys")
    .select(
      "id, organization_id, client_name, project_name, odoo_code, site_location, survey_date, engineer_name, notes, status",
    )
    .eq("id", surveyId)
    .maybeSingle();
  if (!s) notFound();

  const [{ data: contacts }, { data: findings }, { data: photos }, { data: signatures }] =
    await Promise.all([
      supabase
        .from("survey_contacts")
        .select("id, name, role, phone, email, notes")
        .eq("survey_id", surveyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_findings")
        .select("id, title, description, severity")
        .eq("survey_id", surveyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_photos")
        .select("id, caption, storage_path")
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_signatures")
        .select("id, signer_name, signer_role, signed_at, storage_path")
        .eq("survey_id", surveyId)
        .order("signed_at", { ascending: true }),
    ]);

  // URLs firmadas (bucket privado) para fotos y firmas.
  const photoPaths = (photos ?? []).map((p) => p.storage_path);
  const sigPaths = (signatures ?? []).map((x) => x.storage_path);
  const [photoUrls, sigUrls] = await Promise.all([
    photoPaths.length
      ? supabase.storage.from(BUCKET).createSignedUrls(photoPaths, 3600)
      : Promise.resolve({ data: [] as { signedUrl: string }[] }),
    sigPaths.length
      ? supabase.storage.from(BUCKET).createSignedUrls(sigPaths, 3600)
      : Promise.resolve({ data: [] as { signedUrl: string }[] }),
  ]);

  return (
    <SurveyEditor
      survey={{
        id: s.id,
        organization_id: s.organization_id,
        client_name: s.client_name ?? "",
        project_name: s.project_name ?? "",
        odoo_code: s.odoo_code ?? "",
        site_location: s.site_location ?? "",
        survey_date: s.survey_date,
        engineer_name: s.engineer_name ?? "",
        notes: s.notes ?? "",
        status: s.status ?? "borrador",
      }}
      initialContacts={(contacts ?? []).map((c) => ({
        id: c.id,
        name: c.name ?? "",
        role: c.role ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        notes: c.notes ?? "",
      }))}
      initialFindings={(findings ?? []).map((f) => ({
        id: f.id,
        title: f.title ?? "",
        description: f.description ?? "",
        severity: f.severity ?? "media",
      }))}
      initialPhotos={(photos ?? []).map((p, i) => ({
        id: p.id,
        caption: p.caption ?? "",
        path: p.storage_path,
        url: (photoUrls.data ?? [])[i]?.signedUrl ?? "",
      }))}
      initialSignatures={(signatures ?? []).map((x, i) => ({
        id: x.id,
        signer_name: x.signer_name,
        signer_role: x.signer_role ?? "",
        signed_at: x.signed_at,
        path: x.storage_path,
        url: (sigUrls.data ?? [])[i]?.signedUrl ?? "",
      }))}
    />
  );
}
