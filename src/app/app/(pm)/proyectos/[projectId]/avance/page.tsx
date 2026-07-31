import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { SCurve } from "@/components/charts/s-curve";
import { AvanceEditor, type AvanceTask } from "@/components/projects/avance-editor";
import { Card, CardContent } from "@/components/ui/card";
import { ganttCurve, type Snapshot } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";

export default async function AvancePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, code, start_date, end_date")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: tasks }, { data: snapshots }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, name, wbs, progress, weight, parent_id, planned_start, planned_end, sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("progress_snapshots")
      .select("snapshot_date, planned_pct, actual_pct, planned_value, earned_value, actual_cost")
      .eq("project_id", projectId)
      .order("snapshot_date", { ascending: true }),
  ]);

  const all = tasks ?? [];
  const snaps = (snapshots ?? []) as Snapshot[];
  const leaves0 = all.filter((t) => t.parent_id !== null);
  const leaves = leaves0.length ? leaves0 : all;
  const chartData =
    snaps.length > 0
      ? snaps.map((s) => ({
          date: s.snapshot_date,
          plan: Number(s.planned_pct),
          real: s.actual_pct === null ? null : Number(s.actual_pct),
        }))
      : ganttCurve(leaves, { start: project.start_date, end: project.end_date });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Control de Avance</h1>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              PD-F-001
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </header>

      {all.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CalendarRange className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Este proyecto aún no tiene cronograma. Arma el Gantt (fases y tareas
              con fechas) — ese es el plan; aquí registras el avance real.
            </p>
            <Link
              href={`/app/proyectos/${projectId}/cronograma`}
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <CalendarRange className="size-4" />
              Ir al cronograma
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Curva S</h2>
                  <p className="text-xs text-muted-foreground">
                    Plan (del cronograma) vs avance real
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-0.5 w-4 rounded-full bg-[var(--chart-2)]" />
                    Plan
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-0.5 w-4 rounded-full bg-[var(--chart-1)]" />
                    Real
                  </span>
                </div>
              </div>
              <SCurve data={chartData} />
            </CardContent>
          </Card>

          <AvanceEditor projectId={projectId} tasks={all as AvanceTask[]} />
        </>
      )}
    </div>
  );
}
