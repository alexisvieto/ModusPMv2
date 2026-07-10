"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { CalendarClock, Plus, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ReportPdfData } from "@/components/reports/report-pdf-document";
import { parseISODate, toISODate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const ReportPdfButton = dynamic(
  () => import("@/components/reports/report-pdf-button"),
  {
    ssr: false,
    loading: () => (
      <span className="text-xs text-muted-foreground">Preparando PDF…</span>
    ),
  },
);

type Report = Database["public"]["Tables"]["daily_reports"]["Row"];
type EntryRow = {
  description: string;
  quantity: number | null;
  unit: string | null;
};
// Estado local con id estable para keys de React (evita que borrar una fila
// del medio confunda el foco/valor de los inputs).
type LocalEntry = EntryRow & { _id: string };
const withIds = (rows: EntryRow[]): LocalEntry[] =>
  rows.map((e) => ({ ...e, _id: crypto.randomUUID() }));

export type TaskLite = {
  id: string;
  wbs: string | null;
  name: string;
  parent_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  is_milestone: boolean;
};

type Project = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  client_name: string | null;
};

// El formulario vive local: un reporte NUEVO no existe en BD hasta Guardar.
type FormState = {
  id: string | null;
  report_date: string;
  workforce: number;
  hours: number;
  summary: string | null;
  progress_note: string | null;
  ai_summary: string | null;
};

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";
const areaCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

const round1 = (n: number) => Math.round(n * 10) / 10;

const addDays = (iso: string, n: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

const daysBetween = (a: string, b: string) =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);

/** Snapshot para detectar cambios sin guardar (ignora id y los _id locales). */
const snap = (f: FormState, es: LocalEntry[]) =>
  JSON.stringify({
    d: f.report_date,
    w: f.workforce,
    h: f.hours,
    s: f.summary,
    n: f.progress_note,
    a: f.ai_summary,
    e: es.map(({ description, quantity, unit }) => ({ description, quantity, unit })),
  });

export function ReportEditorDialog({
  report,
  initialEntries,
  project,
  tasks,
  lastReportDate,
  authorName,
  currentUserId,
  open,
  onOpenChange,
  brand,
}: {
  report: Report | null; // null = reporte nuevo (se crea al Guardar)
  initialEntries: EntryRow[];
  project: Project;
  tasks: TaskLite[];
  lastReportDate: string | null;
  authorName: string | null;
  currentUserId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brand: Brand;
}) {
  const router = useRouter();
  const isNew = report === null;

  // Actividades del Gantt activas en un rango de fechas (hojas, sin hitos).
  function tasksInRange(from: string, to: string): TaskLite[] {
    const leaves0 = tasks.filter((t) => t.parent_id !== null);
    const pool = leaves0.length ? leaves0 : tasks;
    return pool.filter(
      (t) =>
        !t.is_milestone &&
        t.planned_start &&
        t.planned_end &&
        t.planned_start <= to &&
        t.planned_end >= from,
    );
  }
  const prefillFor = (from: string, to: string): LocalEntry[] =>
    tasksInRange(from, to).map((t) => ({
      _id: crypto.randomUUID(),
      description: `${t.wbs ? `${t.wbs} ` : ""}${t.name}`,
      quantity: null,
      unit: null,
    }));

  // El componente se REMONTA en cada apertura (key desde el board), así que
  // los inicializadores corren una vez por sesión de edición — y solo en el
  // cliente (el primer mount SSR llega con open=false y no toca Date).
  const [form, setForm] = useState<FormState | null>(() => {
    if (!open) return null;
    if (report) {
      return {
        id: report.id,
        report_date: report.report_date,
        workforce: Number(report.workforce),
        hours: Number(report.hours),
        summary: report.summary,
        progress_note: report.progress_note,
        ai_summary: report.ai_summary,
      };
    }
    return {
      id: null,
      report_date: toISODate(new Date()),
      workforce: 0,
      hours: 0,
      summary: null,
      progress_note: null,
      ai_summary: null,
    };
  });
  const [entries, setEntries] = useState<LocalEntry[]>(() => {
    if (!open || !form) return [];
    return report ? withIds(initialEntries) : prefillFor(form.report_date, form.report_date);
  });
  const [savedSnap, setSavedSnap] = useState(() =>
    form ? snap(form, entries) : "",
  );
  const [jornada, setJornada] = useState(() => {
    if (!report) return 8;
    const wf = Number(report.workforce);
    const hrs = Number(report.hours);
    // Deriva la jornada de los datos ya guardados (sin columna extra en BD).
    return wf > 0 && hrs > 0 ? Math.round((hrs / wf) * 10) / 10 : 8;
  });

  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  // Reporte atrasado: oferta de incluir tareas de los días sin reporte.
  const [backfill, setBackfill] = useState<"pending" | "resolved">("pending");
  const entriesTouched = useRef(false);

  const dirty = form !== null && snap(form, entries) !== savedSnap;

  // Días sin reporte entre el último reporte y la fecha elegida (solo nuevo).
  const gapDays =
    isNew && form && lastReportDate && daysBetween(lastReportDate, form.report_date) > 1
      ? daysBetween(lastReportDate, form.report_date) - 1
      : 0;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  // Horas-hombre = Personal × Jornada (cálculo automático, instantáneo y exacto).
  function setWorkforce(v: number) {
    setForm((f) => (f ? { ...f, workforce: v, hours: round1(v * jornada) } : f));
  }
  function setJornadaHours(v: number) {
    setJornada(v);
    setForm((f) => (f ? { ...f, hours: round1(Number(f.workforce) * v) } : f));
  }

  function setDate(v: string) {
    set("report_date", v);
    // En un reporte nuevo, si aún no tocaste las actividades, se re-precargan
    // con las tareas del Gantt de la nueva fecha.
    if (isNew && !entriesTouched.current && v) {
      setEntries(prefillFor(v, v));
      setBackfill("pending");
    }
  }

  function setEntry(i: number, patch: Partial<EntryRow>) {
    entriesTouched.current = true;
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function includeBackfill() {
    if (!form || !lastReportDate) return;
    // Tareas activas desde el día siguiente al último reporte hasta hoy.
    setEntries(prefillFor(addDays(lastReportDate, 1), form.report_date));
    setBackfill("resolved");
  }

  async function generateAI() {
    if (!form) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/report-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          report: {
            projectName: project.name,
            report_date: form.report_date,
            workforce: Number(form.workforce),
            hours: Number(form.hours),
            summary: form.summary,
            progress_note: form.progress_note,
            entries: entries.map(({ description, quantity, unit }) => ({
              description,
              quantity,
              unit,
            })),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error ?? "No se pudo redactar.");
        return;
      }
      setForm((f) => (f ? { ...f, ai_summary: json.summary } : f));
    } catch {
      setAiError("Error de red al contactar la IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      report_date: form.report_date,
      summary: form.summary,
      workforce: Number(form.workforce),
      hours: Number(form.hours),
      progress_note: form.progress_note,
      ai_summary: form.ai_summary,
    };

    let id = form.id;
    if (!id) {
      // El reporte NUEVO se crea recién aquí (no al abrir el editor).
      const { data, error } = await supabase
        .from("daily_reports")
        .insert({
          organization_id: project.organization_id,
          project_id: project.id,
          author_id: currentUserId,
          ...payload,
        })
        .select("id")
        .maybeSingle();
      if (error || !data) {
        toast.error("No se pudo crear el reporte.");
        setSaving(false);
        return;
      }
      id = data.id;
    } else {
      const { error } = await supabase
        .from("daily_reports")
        .update(payload)
        .eq("id", id);
      if (error) {
        toast.error("No se pudo guardar el reporte.");
        setSaving(false);
        return;
      }
    }

    // RPC transaccional: reemplaza todas las actividades en una sola operación.
    const { error: entriesError } = await supabase.rpc("save_report_entries", {
      p_report_id: id,
      p_entries: entries
        .filter((e) => e.description.trim())
        .map((e) => ({
          description: e.description,
          quantity: e.quantity,
          unit: e.unit,
        })),
    });
    if (entriesError) {
      toast.error("No se pudieron guardar las actividades.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setForm((f) => (f ? { ...f, id } : f));
    setSavedSnap(snap(form, entries));
    toast.success("Reporte guardado.");
    router.refresh();
  }

  async function remove() {
    if (!form?.id) return;
    if (!window.confirm("¿Eliminar este reporte diario? No se puede deshacer."))
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("daily_reports")
      .delete()
      .eq("id", form.id);
    if (error) {
      toast.error("No se pudo eliminar.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  // Todo cierre (X, Esc, click afuera) pasa por aquí: con cambios sin
  // guardar se pregunta antes de descartar.
  function handleOpenChange(o: boolean) {
    if (!o && dirty) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(o);
  }

  const pdfData: ReportPdfData | null = form
    ? {
        brand,
        project,
        report: {
          report_date: form.report_date,
          workforce: Number(form.workforce),
          hours: Number(form.hours),
          summary: form.summary,
          progress_note: form.progress_note,
          ai_summary: form.ai_summary,
        },
        entries,
        author: authorName,
      }
    : null;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background shadow-lg transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
        {form && (
          <>
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold">
                  {isNew ? "Nuevo reporte diario" : "Reporte diario"}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {project.name}
                  {form.id ? "" : " · sin guardar"}
                </Dialog.Description>
              </div>
              <button
                aria-label="Cerrar"
                onClick={() => handleOpenChange(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Datos del día — una sola fila en desktop */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="r-date">Fecha</Label>
                  <input
                    id="r-date"
                    type="date"
                    className={fieldCls}
                    value={form.report_date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-wf">Personal en sitio</Label>
                  <input
                    id="r-wf"
                    type="number"
                    min={0}
                    className={fieldCls}
                    value={Number(form.workforce)}
                    onChange={(e) => setWorkforce(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-jornada">Jornada (h/persona)</Label>
                  <input
                    id="r-jornada"
                    type="number"
                    min={0}
                    step={0.5}
                    className={fieldCls}
                    value={jornada}
                    onChange={(e) => setJornadaHours(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Horas-hombre</Label>
                  <div className="flex h-9 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm">
                    <span className="font-medium tabular-nums">
                      {Number(form.hours)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      personal × jornada
                    </span>
                  </div>
                </div>
              </div>

              {/* Reporte atrasado: ofrecer las tareas de los días sin reporte */}
              {gapDays > 0 && backfill === "pending" && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                  <CalendarClock className="size-4 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1">
                    Hay {gapDays} {gapDays === 1 ? "día" : "días"} sin reporte
                    desde el último ({lastReportDate}). ¿Incluir también las
                    tareas del Gantt de esos días?
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={includeBackfill}>
                      Sí, incluir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBackfill("resolved")}
                    >
                      No, solo hoy
                    </Button>
                  </div>
                </div>
              )}

              {/* Dos columnas: texto a la izquierda, actividades a la derecha */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="r-summary">Resumen del día</Label>
                    <textarea
                      id="r-summary"
                      rows={6}
                      className={areaCls}
                      placeholder="En tus palabras: qué se hizo, novedades, bloqueos… La IA redacta el reporte a partir de esto."
                      value={form.summary ?? ""}
                      onChange={(e) => set("summary", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="r-note">Nota de avance (opcional)</Label>
                    <textarea
                      id="r-note"
                      rows={3}
                      className={areaCls}
                      value={form.progress_note ?? ""}
                      onChange={(e) => set("progress_note", e.target.value || null)}
                    />
                  </div>
                </div>

                {/* Actividades — precargadas desde el Gantt del día */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Actividades del día</Label>
                    <button
                      onClick={() => {
                        entriesTouched.current = true;
                        setEntries((p) => [
                          ...p,
                          {
                            _id: crypto.randomUUID(),
                            description: "",
                            quantity: null,
                            unit: null,
                          },
                        ]);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Plus className="size-3.5" /> Actividad
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Precargadas desde el cronograma. Elimina las que no se
                    trabajaron y anota cantidad · unidad en las ejecutadas.
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {entries.map((e, i) => (
                      <div key={e._id} className="flex items-center gap-2">
                        <input
                          placeholder="Descripción de la actividad"
                          className={cn(fieldCls, "min-w-0 flex-1")}
                          value={e.description}
                          onChange={(ev) =>
                            setEntry(i, { description: ev.target.value })
                          }
                        />
                        <input
                          type="number"
                          placeholder="Cant."
                          className={cn(fieldCls, "w-20 shrink-0")}
                          value={e.quantity ?? ""}
                          onChange={(ev) =>
                            setEntry(i, {
                              quantity: ev.target.value
                                ? Number(ev.target.value)
                                : null,
                            })
                          }
                        />
                        <input
                          placeholder="Un."
                          className={cn(fieldCls, "w-16 shrink-0")}
                          value={e.unit ?? ""}
                          onChange={(ev) =>
                            setEntry(i, { unit: ev.target.value || null })
                          }
                        />
                        <button
                          onClick={() => {
                            entriesTouched.current = true;
                            setEntries((p) => p.filter((_, idx) => idx !== i));
                          }}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                    {entries.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sin actividades para esta fecha. Agrega una con “+
                        Actividad”.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Reporte redactado por IA — el entregable */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Sparkles className="size-4" />
                    Reporte del día
                  </div>
                  <Button
                    size="sm"
                    onClick={generateAI}
                    disabled={aiLoading}
                    className="h-8"
                  >
                    {aiLoading ? "Redactando…" : "Redactar con IA"}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Redacción profesional a partir del resumen y las actividades —
                  lista para gerencia y cliente. Puedes editarla antes de guardar.
                </p>
                {aiError && (
                  <p className="mt-2 text-xs text-destructive">{aiError}</p>
                )}
                <textarea
                  rows={7}
                  className={`${areaCls} mt-3`}
                  placeholder="Pulsa “Redactar con IA” o escribe el reporte…"
                  value={form.ai_summary ?? ""}
                  onChange={(e) => set("ai_summary", e.target.value || null)}
                />
              </div>
            </div>

            <div className="flex flex-row items-center justify-between gap-2 border-t px-5 py-4">
              {form.id ? (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={remove}
                >
                  <Trash2 className="size-4" />
                  Eliminar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {form.id && pdfData && (
                  <ReportPdfButton
                    data={pdfData}
                    fileName={`Reporte_${form.report_date}.pdf`}
                    label="Exportar reporte"
                  />
                )}
                <Button onClick={save} disabled={saving || aiLoading || !dirty}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>

            {/* Confirmación de cierre con cambios sin guardar */}
            {confirmClose && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg">
                  <p className="font-medium">¿Cerrar sin guardar los cambios?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Este reporte tiene cambios que se perderán.
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmClose(false)}
                    >
                      No, seguir editando
                    </Button>
                    <Button
                      size="sm"
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => {
                        setConfirmClose(false);
                        onOpenChange(false);
                      }}
                    >
                      Sí, cerrar sin guardar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
