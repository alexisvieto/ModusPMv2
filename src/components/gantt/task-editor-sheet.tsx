"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  makeCalendar,
  workingDaysBetween,
  type CalendarException,
} from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

const STATUSES: { v: TaskStatus; l: string }[] = [
  { v: "not_started", l: "Sin iniciar" },
  { v: "in_progress", l: "En curso" },
  { v: "completed", l: "Completado" },
  { v: "delayed", l: "Retrasado" },
];

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function TaskEditorSheet({
  task,
  profiles,
  workdays,
  exceptions,
  open,
  onOpenChange,
}: {
  task: Task | null;
  profiles: { id: string; full_name: string | null }[];
  workdays: number[];
  exceptions: CalendarException[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Task | null>(task);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(task), [task]);

  function set<K extends keyof Task>(k: K, v: Task[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  const isPhase = form ? form.parent_id === null : false;
  const cal = makeCalendar(workdays, exceptions);
  const duration =
    form && !form.is_milestone
      ? workingDaysBetween(form.planned_start, form.planned_end, cal)
      : 0;

  async function save() {
    if (!form) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({
        name: form.name,
        is_milestone: form.is_milestone,
        planned_start: form.planned_start,
        planned_end: form.is_milestone ? form.planned_start : form.planned_end,
        duration_days: duration || null,
        progress: form.progress,
        status: form.status,
        assignee_id: form.assignee_id,
        planned_cost: form.planned_cost,
        actual_start: form.actual_start,
        actual_end: form.actual_end,
      })
      .eq("id", form.id);
    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!form) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", form.id);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {form && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{isPhase ? "Editar fase" : "Editar tarea"}</SheetTitle>
              <SheetDescription>
                {form.wbs ? `WBS ${form.wbs}` : "Cronograma"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-1.5">
                <Label htmlFor="t-name">Nombre</Label>
                <Input
                  id="t-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>

              {!isPhase && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_milestone}
                    onChange={(e) => set("is_milestone", e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Es un hito (milestone)
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-ps">Inicio (plan)</Label>
                  <input
                    id="t-ps"
                    type="date"
                    className={fieldCls}
                    value={form.planned_start ?? ""}
                    onChange={(e) => set("planned_start", e.target.value || null)}
                  />
                </div>
                {!form.is_milestone && (
                  <div className="space-y-1.5">
                    <Label htmlFor="t-pe">Fin (plan)</Label>
                    <input
                      id="t-pe"
                      type="date"
                      className={fieldCls}
                      value={form.planned_end ?? ""}
                      onChange={(e) => set("planned_end", e.target.value || null)}
                    />
                  </div>
                )}
              </div>

              {!form.is_milestone && (
                <p className="text-xs text-muted-foreground">
                  Duración:{" "}
                  <span className="font-medium text-foreground">
                    {duration} días hábiles
                  </span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-prog">% Avance</Label>
                  <input
                    id="t-prog"
                    type="number"
                    min={0}
                    max={100}
                    className={fieldCls}
                    value={Number(form.progress)}
                    onChange={(e) =>
                      set("progress", Math.max(0, Math.min(100, Number(e.target.value))))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-status">Estado</Label>
                  <select
                    id="t-status"
                    className={fieldCls}
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as TaskStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.v} value={s.v}>
                        {s.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-assignee">Responsable</Label>
                <select
                  id="t-assignee"
                  className={fieldCls}
                  value={form.assignee_id ?? ""}
                  onChange={(e) => set("assignee_id", e.target.value || null)}
                >
                  <option value="">Sin asignar</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? "—"}
                    </option>
                  ))}
                </select>
              </div>

              {!isPhase && (
                <div className="space-y-1.5">
                  <Label htmlFor="t-cost">Costo planificado (USD)</Label>
                  <input
                    id="t-cost"
                    type="number"
                    min={0}
                    className={fieldCls}
                    value={Number(form.planned_cost)}
                    onChange={(e) => set("planned_cost", Number(e.target.value))}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="t-as">Inicio real</Label>
                  <input
                    id="t-as"
                    type="date"
                    className={fieldCls}
                    value={form.actual_start ?? ""}
                    onChange={(e) => set("actual_start", e.target.value || null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-ae">Fin real</Label>
                  <input
                    id="t-ae"
                    type="date"
                    className={fieldCls}
                    value={form.actual_end ?? ""}
                    onChange={(e) => set("actual_end", e.target.value || null)}
                  />
                </div>
              </div>
            </div>

            <SheetFooter className="flex-row justify-between border-t">
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={remove}
              >
                <Trash2 className="size-4" />
                Eliminar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
