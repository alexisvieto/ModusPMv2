import { notFound } from "next/navigation";

import { GanttBoard } from "@/components/gantt/gantt-board";
import { createClient } from "@/lib/supabase/server";

export default async function CronogramaPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, organization_id, name, start_date, end_date, workdays, baseline_set_at, currency, budget",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: tasks }, { data: profiles }, { data: exceptions }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("wbs", { ascending: true }),
      supabase.from("profiles").select("id, full_name"),
      supabase
        .from("calendar_exceptions")
        .select("date, is_working, note")
        .eq("project_id", projectId),
    ]);

  return (
    <div className="p-4 md:p-6">
      <GanttBoard
        project={project}
        tasks={tasks ?? []}
        profiles={profiles ?? []}
        exceptions={exceptions ?? []}
      />
    </div>
  );
}
