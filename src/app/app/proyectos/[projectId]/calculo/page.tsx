import { notFound } from "next/navigation";

import { TakeoffHome } from "@/components/takeoff/takeoff-home";
import { orgMemberProfiles } from "@/lib/supabase/org-profiles";
import { createClient } from "@/lib/supabase/server";

export default async function CalculoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name, code")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: systems }, { data: scopeStatus }, { data: scopeDocs }, profiles] =
    await Promise.all([
      supabase
        .from("takeoff_systems")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("takeoff_scope_status")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("takeoff_scope_docs")
        .select(
          "id, doc_name, status, progress, page_count, project_title, contracting_entity, analyzed_at, created_at",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      orgMemberProfiles(supabase, project.organization_id),
    ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cálculo de planos</h1>
        <p className="text-sm text-muted-foreground">
          Sube tus planos y el motor cuenta cada elemento. Tú verificas y
          apruebas. La IA aprende de cada proyecto analizado.
        </p>
      </div>
      <TakeoffHome
        project={project}
        systems={systems ?? []}
        scopeStatus={scopeStatus ?? null}
        scopeDocs={scopeDocs ?? []}
        profiles={profiles}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
