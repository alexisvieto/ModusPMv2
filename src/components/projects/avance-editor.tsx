"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveAvance } from "@/app/app/(pm)/proyectos/[projectId]/avance/actions";

export type AvanceTask = {
  id: string;
  name: string;
  wbs: string | null;
  progress: number;
  weight: number | null;
  parent_id: string | null;
};

export function AvanceEditor({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: AvanceTask[];
}) {
  const router = useRouter();
  const [prog, setProg] = useState<Record<string, number>>(
    Object.fromEntries(tasks.map((t) => [t.id, Number(t.progress) || 0])),
  );
  const [saving, setSaving] = useState(false);

  const phases = tasks.filter((t) => t.parent_id === null);
  const leaves = tasks.filter((t) => t.parent_id !== null);
  const flat = leaves.length === 0; // proyecto sin jerarquía: fases = hojas
  const editable = flat ? phases : leaves;
  const wOf = (t: AvanceTask) => Number(t.weight) || 1;

  const rollup = (items: AvanceTask[]) => {
    const tw = items.reduce((a, t) => a + wOf(t), 0) || 1;
    const done = items.reduce((a, t) => a + wOf(t) * (prog[t.id] ?? 0), 0);
    return Math.round((done / tw) * 10) / 10;
  };
  const total = rollup(editable);

  function set(id: string, v: string) {
    const n = Math.min(Math.max(Math.round(Number(v) || 0), 0), 100);
    setProg((p) => ({ ...p, [id]: n }));
  }

  async function guardar() {
    if (saving) return;
    setSaving(true);
    const res = await saveAvance(
      projectId,
      editable.map((t) => ({ id: t.id, progress: prog[t.id] ?? 0 })),
    );
    setSaving(false);
    if (!res.ok) {
      toast.error("No se guardó", { description: res.error, duration: 10000 });
      return;
    }
    toast.success("Avance guardado.");
    router.refresh();
  }

  const row = (t: AvanceTask) => (
    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {t.wbs && (
            <span className="font-mono text-xs text-muted-foreground">{t.wbs}</span>
          )}
          <span className="truncate text-sm">{t.name}</span>
        </div>
        <Progress value={prog[t.id] ?? 0} className="mt-1.5 h-1.5" />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          value={prog[t.id] ?? 0}
          onChange={(e) => set(t.id, e.target.value)}
          className="h-9 w-16 rounded-md border border-input bg-transparent px-2 text-right text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Avance real (ponderado)</p>
          <p className="text-2xl font-semibold tabular-nums text-[#0f2044]">{total}%</p>
        </div>
        <Button onClick={guardar} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Guardando…" : "Guardar avance"}
        </Button>
      </div>

      {flat ? (
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {phases.map(row)}
        </div>
      ) : (
        <div className="space-y-4">
          {phases.map((ph) => {
            const kids = leaves.filter((l) => l.parent_id === ph.id);
            if (!kids.length) return null;
            return (
              <div key={ph.id} className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center justify-between gap-2 border-b bg-[#0f2044]/[0.04] px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    {ph.wbs && (
                      <span className="font-mono text-xs text-muted-foreground">{ph.wbs}</span>
                    )}
                    <span className="truncate">{ph.name}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {rollup(kids)}%
                  </span>
                </div>
                <div className="divide-y">{kids.map(row)}</div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Actualiza el % de cada tarea. Al guardar, se registra el avance del día y
        la curva real se actualiza.
      </p>
    </div>
  );
}
