"use server";

import { revalidatePath } from "next/cache";

import { ganttSnapshot } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";

// Guarda el avance (% por tarea) y crea/actualiza el snapshot del día → así la
// curva REAL se construye histórica punto a punto. Reusa el motor del Gantt.
export async function saveAvance(
  projectId: string,
  updates: { id: string; progress: number }[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  for (const u of updates) {
    const p = Math.min(Math.max(Math.round(u.progress) || 0, 0), 100);
    const status = p >= 100 ? "completed" : p > 0 ? "in_progress" : "not_started";
    const { error } = await supabase
      .from("tasks")
      .update({ progress: p, status })
      .eq("id", u.id)
      .eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
  }

  // Recalcular y persistir el snapshot de hoy (plan vs real).
  const { data: project } = await supabase
    .from("projects")
    .select("start_date, end_date, budget, organization_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Proyecto no encontrado." };

  const [{ data: tasks }, { data: costs }] = await Promise.all([
    supabase
      .from("tasks")
      .select("planned_start, planned_end, progress, weight, parent_id")
      .eq("project_id", projectId),
    supabase.from("cost_entries").select("actual").eq("project_id", projectId),
  ]);
  const actualCost = (costs ?? []).reduce((a, c) => a + Number(c.actual ?? 0), 0);
  const all = tasks ?? [];
  const leaves0 = all.filter((t) => t.parent_id !== null);
  const leaves = leaves0.length ? leaves0 : all;

  const snap = ganttSnapshot(
    leaves,
    project.start_date,
    project.end_date,
    Number(project.budget ?? 0),
    actualCost,
  );
  if (snap) {
    const { error } = await supabase.from("progress_snapshots").upsert(
      {
        organization_id: project.organization_id,
        project_id: projectId,
        snapshot_date: snap.snapshot_date,
        planned_pct: snap.planned_pct,
        actual_pct: snap.actual_pct,
        planned_value: snap.planned_value,
        earned_value: snap.earned_value,
        actual_cost: snap.actual_cost,
      },
      { onConflict: "project_id,snapshot_date" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/app/proyectos/${projectId}/avance`);
  revalidatePath(`/app/proyectos/${projectId}`);
  return { ok: true };
}
