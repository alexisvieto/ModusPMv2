import { notFound } from "next/navigation";

import { PunchBoard } from "@/components/punch/punch-board";
import { createClient } from "@/lib/supabase/server";

export default async function PendientesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const { data: items } = await supabase
    .from("punch_items")
    .select("*")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pendientes (Punch list)
        </h1>
        <p className="text-sm text-muted-foreground">
          Lista de pendientes con responsable, prioridad y fecha límite. La
          campana de la barra superior te avisa de los vencimientos.
        </p>
      </div>
      <PunchBoard project={project} initialItems={items ?? []} />
    </div>
  );
}
