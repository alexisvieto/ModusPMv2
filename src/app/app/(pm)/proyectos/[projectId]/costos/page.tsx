import { notFound } from "next/navigation";

import { CostBoard } from "@/components/costs/cost-board";
import { createClient } from "@/lib/supabase/server";

export default async function CostosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name, currency")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  // Paginado: la tabla carga la primera página; los KPIs y la gráfica salen
  // de cost_summary (agregados en BD, exactos aunque haya miles de filas).
  const PAGE = 500;
  const [{ data: summary }, { data: costs, count }] = await Promise.all([
    supabase.rpc("cost_summary", { p_project_id: projectId }),
    supabase
      .from("cost_entries")
      .select("*", { count: "exact" })
      .eq("project_id", projectId)
      .order("cost_code", { ascending: true })
      .order("id", { ascending: true })
      .range(0, PAGE - 1),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Costos</h1>
        <p className="text-sm text-muted-foreground">
          Control de costos — presupuesto, comprometido y real por categoría,
          con importación de Excel/CSV.
        </p>
      </div>
      <CostBoard
        project={project}
        costs={costs ?? []}
        summary={summary ?? []}
        totalCount={count ?? 0}
        pageSize={PAGE}
      />
    </div>
  );
}
