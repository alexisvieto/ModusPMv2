"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Flag, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskEditorSheet } from "@/components/gantt/task-editor-sheet";
import {
  makeCalendar,
  parseISODate,
  type CalendarException,
} from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Project = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "organization_id"
  | "name"
  | "start_date"
  | "end_date"
  | "workdays"
  | "baseline_set_at"
  | "currency"
  | "budget"
>;
type Profile = { id: string; full_name: string | null };

const DAY_MS = 86400000;
const ROW_H = 40;
const HEADER_H = 52;
const LEFT_W = 380;
const ZOOMS = { mes: 4.2, semana: 11 } as const;
type Zoom = keyof typeof ZOOMS;

const STATUS_FILL: Record<string, string> = {
  not_started: "bg-muted-foreground/40",
  in_progress: "bg-primary",
  completed: "bg-success",
  delayed: "bg-destructive",
};

export function GanttBoard({
  project,
  tasks,
  profiles,
  exceptions,
}: {
  project: Project;
  tasks: Task[];
  profiles: Profile[];
  exceptions: CalendarException[];
}) {
  const router = useRouter();
  const [zoom, setZoom] = useState<Zoom>("mes");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [present, setPresent] = useState<string[]>([]);
  const pxPerDay = ZOOMS[zoom];

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name ?? "—");
    return m;
  }, [profiles]);

  // ----- Realtime: refrescar al cambiar tareas -----
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`gantt-tasks-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${project.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, router]);

  // ----- Presencia -----
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      let me = "Invitado";
      try {
        const { data } = await supabase.auth.getUser();
        me =
          (data.user && nameOf.get(data.user.id)) ||
          data.user?.email ||
          "Invitado";
      } catch {
        // sin sesión
      }
      channel = supabase.channel(`presence-gantt-${project.id}`);
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState() as Record<
            string,
            { name: string }[]
          >;
          const names = Object.values(state)
            .flat()
            .map((p) => p.name);
          if (active) setPresent(Array.from(new Set(names)));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel!.track({ name: me });
        });
    })();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [project.id, nameOf]);

  const { rangeStart, totalDays } = useMemo(() => {
    const ps = project.start_date ? parseISODate(project.start_date) : new Date();
    const pe = project.end_date ? parseISODate(project.end_date) : new Date();
    const rs = new Date(ps.getFullYear(), ps.getMonth(), 1);
    const re = new Date(pe.getFullYear(), pe.getMonth() + 1, 0);
    return { rangeStart: rs, totalDays: Math.round((+re - +rs) / DAY_MS) + 1 };
  }, [project.start_date, project.end_date]);

  const timelineWidth = totalDays * pxPerDay;
  const xOf = (d: Date) => ((+d - +rangeStart) / DAY_MS) * pxPerDay;
  const xOfISO = (s: string | null) => (s ? xOf(parseISODate(s)) : 0);

  const phases = useMemo(
    () =>
      tasks.filter((t) => !t.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [tasks],
  );
  const childrenOf = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_id) {
        const arr = m.get(t.parent_id) ?? [];
        arr.push(t);
        m.set(t.parent_id, arr);
      }
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [tasks]);

  const rows: { task: Task; level: number; isPhase: boolean }[] = [];
  for (const p of phases) {
    rows.push({ task: p, level: 0, isPhase: true });
    if (!collapsed.has(p.id)) {
      for (const c of childrenOf.get(p.id) ?? [])
        rows.push({ task: c, level: 1, isPhase: false });
    }
  }

  const months = useMemo(() => {
    const out: { label: string; x: number }[] = [];
    let cur = new Date(rangeStart);
    for (let i = 0; i < 60; i++) {
      out.push({
        label: cur.toLocaleDateString("es-PA", { month: "short", year: "2-digit" }),
        x: xOf(cur),
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      if (xOf(cur) >= timelineWidth) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, pxPerDay, timelineWidth]);

  const todayX = xOf(new Date());
  const todayInRange = todayX >= 0 && todayX <= timelineWidth;

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEditor(task: Task) {
    setEditing(task);
    setSheetOpen(true);
  }

  async function addPhase() {
    const supabase = createClient();
    const { data } = await supabase
      .from("tasks")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        name: "Nueva fase",
        wbs: String(phases.length + 1),
        sort_order: (phases.at(-1)?.sort_order ?? 0) + 1,
        planned_start: project.start_date,
        planned_end: project.start_date,
        status: "not_started",
        progress: 0,
      })
      .select()
      .single();
    router.refresh();
    if (data) openEditor(data);
  }

  async function addTask(phase: Task) {
    const supabase = createClient();
    const kids = childrenOf.get(phase.id) ?? [];
    const { data } = await supabase
      .from("tasks")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        parent_id: phase.id,
        name: "Nueva tarea",
        wbs: `${phase.wbs ?? "?"}.${kids.length + 1}`,
        sort_order: (kids.at(-1)?.sort_order ?? 0) + 1,
        planned_start: phase.planned_start ?? project.start_date,
        planned_end:
          phase.planned_end ?? phase.planned_start ?? project.start_date,
        status: "not_started",
        progress: 0,
        weight: 1,
        planned_cost: 0,
      })
      .select()
      .single();
    router.refresh();
    if (data) openEditor(data);
  }

  async function setBaseline() {
    if (
      !window.confirm(
        "¿Establecer la línea base con el plan actual? Congela el plan para comparar contra el avance real.",
      )
    )
      return;
    const supabase = createClient();
    await Promise.all(
      tasks.map((t) =>
        supabase
          .from("tasks")
          .update({ baseline_start: t.planned_start, baseline_end: t.planned_end })
          .eq("id", t.id),
      ),
    );
    await supabase
      .from("projects")
      .update({ baseline_set_at: new Date().toISOString() })
      .eq("id", project.id);
    router.refresh();
  }

  function geomOf(t: Task) {
    const start = t.planned_start ?? t.baseline_start;
    const end = t.planned_end ?? t.baseline_end ?? start;
    if (!start) return null;
    const x = xOfISO(start);
    return {
      x,
      w: Math.max(pxPerDay, xOfISO(end) - x + pxPerDay),
      start,
      end: end ?? start,
    };
  }

  return (
    <>
      <div className="rounded-xl border bg-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Cronograma</h2>
            {project.baseline_set_at ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Línea base ·{" "}
                {formatDate(project.baseline_set_at, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            ) : (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                Sin línea base
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {present.length > 0 && (
              <div className="mr-1 flex -space-x-2">
                {present.slice(0, 4).map((n, i) => (
                  <span
                    key={i}
                    title={`${n} · en línea`}
                    className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[9px] font-medium text-primary"
                  >
                    {initials(n)}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              {(["mes", "semana"] as Zoom[]).map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    zoom === z
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {z}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={setBaseline}>
              Establecer línea base
            </Button>
            <Button size="sm" onClick={addPhase}>
              <Plus className="size-4" />
              Fase
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="relative overflow-x-auto">
          <div style={{ width: LEFT_W + timelineWidth }}>
            {/* Header */}
            <div className="sticky top-0 z-20 flex bg-card" style={{ height: HEADER_H }}>
              <div
                className="sticky left-0 z-30 flex items-end border-r border-b bg-card px-4 pb-2"
                style={{ width: LEFT_W }}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  Estructura (WBS)
                </span>
              </div>
              <div className="relative border-b" style={{ width: timelineWidth }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="absolute bottom-1 text-[11px] font-medium text-muted-foreground capitalize"
                    style={{ left: m.x + 6 }}
                  >
                    {m.label}
                  </div>
                ))}
                {todayInRange && (
                  <span
                    className="absolute bottom-1 text-[10px] font-semibold text-primary"
                    style={{ left: todayX + 3 }}
                  >
                    hoy
                  </span>
                )}
              </div>
            </div>

            {/* Rows */}
            {rows.map(({ task, level, isPhase }) => {
              const geom = geomOf(task);
              const progress = Math.min(100, Math.max(0, Number(task.progress)));
              const fill = STATUS_FILL[task.status] ?? STATUS_FILL.not_started;
              return (
                <div
                  key={task.id}
                  className="group relative z-10 flex border-b last:border-b-0 hover:bg-muted/30"
                  style={{ height: ROW_H }}
                >
                  {/* Left cell (click = editar) */}
                  <div
                    onClick={() => openEditor(task)}
                    className="sticky left-0 z-20 flex cursor-pointer items-center gap-2 border-r bg-card pr-3 group-hover:bg-muted/30"
                    style={{ width: LEFT_W, paddingLeft: 12 + level * 16 }}
                  >
                    {isPhase ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(task.id);
                        }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {collapsed.has(task.id) ? (
                          <ChevronRight className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">
                      {task.wbs}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        isPhase && "font-semibold",
                      )}
                    >
                      {task.is_milestone && (
                        <Flag className="mr-1 inline size-3 text-primary" />
                      )}
                      {task.name}
                    </span>
                    {isPhase && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addTask(task);
                        }}
                        title="Agregar tarea"
                        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    )}
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {Math.round(progress)}%
                    </span>
                    {!isPhase && task.assignee_id && (
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary"
                        title={nameOf.get(task.assignee_id) ?? ""}
                      >
                        {initials(nameOf.get(task.assignee_id))}
                      </span>
                    )}
                  </div>

                  {/* Timeline cell */}
                  <div className="relative" style={{ width: timelineWidth }}>
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-border/40"
                        style={{ left: m.x }}
                      />
                    ))}
                    {todayInRange && (
                      <div
                        className="absolute top-0 bottom-0 border-l border-primary/50"
                        style={{ left: todayX }}
                      />
                    )}

                    {geom && task.is_milestone ? (
                      <div
                        className="absolute size-3 rotate-45 rounded-[2px] bg-primary ring-2 ring-card"
                        style={{ left: geom.x - 6, top: ROW_H / 2 - 6 }}
                        title={task.name}
                      />
                    ) : geom ? (
                      <>
                        {task.baseline_start && task.baseline_end && (
                          <div
                            className="absolute h-[3px] rounded-full bg-muted-foreground/30"
                            style={{
                              left: xOfISO(task.baseline_start),
                              width: Math.max(
                                2,
                                xOfISO(task.baseline_end) -
                                  xOfISO(task.baseline_start) +
                                  pxPerDay,
                              ),
                              top: isPhase ? 26 : 30,
                            }}
                          />
                        )}
                        <div
                          className={cn(
                            "absolute overflow-hidden rounded-md border border-border bg-muted",
                            isPhase ? "h-2.5" : "h-5",
                          )}
                          style={{
                            left: geom.x,
                            width: geom.w,
                            top: isPhase ? ROW_H / 2 - 5 : ROW_H / 2 - 10,
                          }}
                          title={`${formatDate(geom.start)} – ${formatDate(geom.end)} · ${Math.round(progress)}%`}
                        >
                          <div
                            className={cn("h-full", isPhase ? "bg-primary/70" : fill)}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                Aún no hay fases en el cronograma.
                <Button size="sm" onClick={addPhase}>
                  <Plus className="size-4" />
                  Crear primera fase
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskEditorSheet
        task={editing}
        profiles={profiles}
        workdays={project.workdays}
        exceptions={exceptions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

function initials(name?: string | null) {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}
