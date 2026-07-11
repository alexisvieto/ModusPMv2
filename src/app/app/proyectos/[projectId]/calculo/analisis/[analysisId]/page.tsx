import { notFound } from "next/navigation";

import { VerificationViewer } from "@/components/takeoff/verification-viewer";
import { createClient } from "@/lib/supabase/server";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ projectId: string; analysisId: string }>;
}) {
  const { projectId, analysisId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: analysis } = await supabase
    .from("takeoff_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("organization_id", project.organization_id)
    .maybeSingle();
  if (!analysis) notFound();

  const { data: system } = await supabase
    .from("takeoff_systems")
    .select("id, display_name, system_type")
    .eq("id", analysis.system_id)
    .maybeSingle();
  if (!system) notFound();

  const [{ data: sheets }, { data: detections }] = await Promise.all([
    supabase
      .from("takeoff_sheets")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("sheet_number", { ascending: true }),
    supabase
      .from("takeoff_detections")
      .select("id, sheet_id, element_key, x, y, confidence, method, status, original_key")
      .in(
        "sheet_id",
        (
          await supabase
            .from("takeoff_sheets")
            .select("id")
            .eq("analysis_id", analysisId)
        ).data?.map((s) => s.id) ?? ["00000000-0000-0000-0000-000000000000"],
      ),
  ]);

  // Signed URLs de las imágenes de plano (bucket privado) para el visor.
  const imgUrls: Record<string, string> = {};
  for (const s of sheets ?? []) {
    if (s.snapshot_path) {
      const { data } = await supabase.storage
        .from("takeoff-temp")
        .createSignedUrl(s.snapshot_path, 3600);
      if (data?.signedUrl) imgUrls[s.id] = data.signedUrl;
    }
  }

  return (
    <div className="p-0">
      <VerificationViewer
        project={project}
        analysis={{
          id: analysis.id,
          name: analysis.name,
          status: analysis.status,
          system_type: analysis.system_type,
        }}
        system={system}
        sheets={sheets ?? []}
        detections={detections ?? []}
        imgUrls={imgUrls}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
