import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MinutaVisitaForm } from "@/components/comercial/minuta-visita-form";
import { SurveyAdminView } from "@/components/comercial/survey-admin-view";
import { VtF004Form } from "@/components/comercial/vtf004-form";
import { SiteSurveyForm } from "@/components/operaciones/site-survey-form";
import { requireDepartment } from "@/lib/access";
import { toMinuta } from "@/lib/comercial/minuta";
import { toVtF004 } from "@/lib/comercial/vtf004";
import { toSiteSurvey, siteSurveyPhotoPaths } from "@/lib/operaciones/site-survey";
import { createClient } from "@/lib/supabase/server";

export default async function DocRecordPage({
  params,
}: {
  params: Promise<{ key: string; code: string; recordId: string }>;
}) {
  const { key, code, recordId } = await params;
  await requireDepartment(key);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .maybeSingle();
  const org = membership?.organization_id ?? "";

  const { data: format } = await supabase
    .from("doc_formats")
    .select("id, code, name, kind")
    .eq("organization_id", org)
    .eq("code", code)
    .eq("department_key", key)
    .maybeSingle();
  if (!format) notFound();

  const { data: rec } = await supabase
    .from("doc_records")
    .select(
      "id, record_label, title, status, data, created_by_name, created_at, public_token, answered_at",
    )
    .eq("id", recordId)
    .eq("format_id", format.id)
    .maybeSingle();
  if (!rec) notFound();

  // Site survey: firmar las URLs de las fotos existentes para mostrarlas.
  const surveyPhotoUrls: Record<string, string> = {};
  if (format.code === "PY-F-014") {
    const paths = siteSurveyPhotoPaths(toSiteSurvey(rec.data));
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("survey-evidence")
        .createSignedUrls(paths, 3600);
      for (const s of signed ?? [])
        if (s.signedUrl && s.path) surveyPhotoUrls[s.path] = s.signedUrl;
    }
  }

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-[#0f2044] px-4 text-white md:px-6">
        <Link
          href={`/app/d/${key}/doc/${code}`}
          className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {format.name}
        </Link>
        <span className="h-4 w-px bg-white/20" />
        <span className="text-sm font-semibold">{rec.record_label}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/70">
          {format.code}
        </span>
      </header>

      {format.kind === "public_survey" ? (
        <SurveyAdminView
          recordLabel={rec.record_label}
          formatCode={format.code}
          status={rec.status}
          answeredAt={rec.answered_at}
          publicToken={rec.public_token}
          data={rec.data}
        />
      ) : format.code === "PY-F-014" ? (
        <SiteSurveyForm
          recordId={rec.id}
          recordLabel={rec.record_label}
          formatCode={format.code}
          status={rec.status}
          elaboradoPor={rec.created_by_name}
          org={org}
          initial={toSiteSurvey(rec.data)}
          photoUrls={surveyPhotoUrls}
        />
      ) : format.code === "VT-F-004" ? (
        <VtF004Form
          recordId={rec.id}
          recordLabel={rec.record_label}
          formatCode={format.code}
          status={rec.status}
          elaboradoPor={rec.created_by_name}
          initial={toVtF004(rec.data)}
        />
      ) : (
        <MinutaVisitaForm
          recordId={rec.id}
          recordLabel={rec.record_label}
          formatCode={format.code}
          status={rec.status}
          elaboradoPor={rec.created_by_name}
          initial={toMinuta(rec.data)}
        />
      )}
    </div>
  );
}
