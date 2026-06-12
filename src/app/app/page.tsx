import { ProjectHub } from "@/components/projects/project-hub";
import { createClient } from "@/lib/supabase/server";

export default async function AppHome() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, code, client_name, description, status, start_date, end_date, location, currency, budget",
    )
    .order("created_at", { ascending: false });

  return (
    <ProjectHub
      projects={projects ?? []}
      orgId={membership?.organization_id ?? null}
    />
  );
}
