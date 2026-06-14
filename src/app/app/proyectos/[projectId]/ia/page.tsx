import { notFound } from "next/navigation";

import { IaView } from "@/components/ia/ia-view";
import { createClient } from "@/lib/supabase/server";

export default async function IaPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name, code")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: cfg } = await supabase
    .from("ai_provider_configs")
    .select("provider, model, monthly_budget_usd, is_enabled, api_key_set")
    .eq("organization_id", project.organization_id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Inteligencia Artificial
        </h1>
        <p className="text-sm text-muted-foreground">
          Diagnóstico ejecutivo del proyecto y configuración de IA por organización.
        </p>
      </div>
      <IaView
        projectId={project.id}
        orgId={project.organization_id}
        config={cfg ?? null}
      />
    </div>
  );
}
