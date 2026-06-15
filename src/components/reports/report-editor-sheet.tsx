"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, X } from "lucide-react";

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
import type { ReportPdfData } from "@/components/reports/report-pdf-document";
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
type ReportStatus = Database["public"]["Enums"]["report_status"];
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
type Project = { name: string; code: string | null; client_name: string | null };

const STATUS: { v: ReportStatus; l: string }[] = [
  { v: "draft", l: "Borrador" },
  { v: "submitted", l: "Enviado" },
  { v: "approved", l: "Aprobado" },
];

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";
const areaCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function ReportEditorSheet({
  report,
  initialEntries,
  project,
  authorName,
  open,
  onOpenChange,
  brand,
}: {
  report: Report | null;
  initialEntries: EntryRow[];
  project: Project;
  authorName: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brand: Brand;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Report | null>(report);
  const [entries, setEntries] = useState<LocalEntry[]>(() =>
    withIds(initialEntries),
  );
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [jornada, setJornada] = useState(8);

  // Resincroniza el formulario al cambiar el reporte (ajuste de estado en
  // render — patrón recomendado por React, sin efecto).
  const [synced, setSynced] = useState({ report, initialEntries });
  if (synced.report !== report || synced.initialEntries !== initialEntries) {
    setSynced({ report, initialEntries });
    setForm(report);
    setEntries(withIds(initialEntries));
    setAiError(null);
    if (report) {
      const wf = Number(report.workforce);
      const hrs = Number(report.hours);
      // Deriva la jornada de los datos ya guardados (sin columna extra en BD).
      setJornada(wf > 0 && hrs > 0 ? Math.round((hrs / wf) * 10) / 10 : 8);
    }
  }

  function set<K extends keyof Report>(k: K, v: Report[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;

  // Horas-hombre = Personal × Jornada (cálculo automático, instantáneo y exacto).
  function setWorkforce(v: number) {
    setForm((f) => (f ? { ...f, workforce: v, hours: round1(v * jornada) } : f));
  }
  function setJornadaHours(v: number) {
    setJornada(v);
    setForm((f) => (f ? { ...f, hours: round1(Number(f.workforce) * v) } : f));
  }

  function setEntry(i: number, patch: Partial<EntryRow>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function generateAI() {
    if (!form) return;
    const reportId = form.id;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/report-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.project_id,
          report: {
            projectName: project.name,
            report_date: form.report_date,
            weather: form.weather,
            workforce: Number(form.workforce),
            hours: Number(form.hours),
            summary: form.summary,
            progress_note: form.progress_note,
            entries,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error ?? "No se pudo generar.");
        return;
      }
      // Solo aplica si seguimos en el mismo reporte (evita que el resumen
      // caiga en otro reporte si el usuario cambió de uno a otro).
      setForm((f) =>
        f && f.id === reportId ? { ...f, ai_summary: json.summary } : f,
      );
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
    const { error } = await supabase
      .from("daily_reports")
      .update({
        report_date: form.report_date,
        weather: form.weather,
        summary: form.summary,
        workforce: Number(form.workforce),
        hours: Number(form.hours),
        progress_note: form.progress_note,
        ai_summary: form.ai_summary,
        status: form.status,
      })
      .eq("id", form.id);
    if (error) {
      toast.error("No se pudo guardar el reporte.");
      setSaving(false);
      return;
    }

    const { error: delError } = await supabase
      .from("daily_report_entries")
      .delete()
      .eq("daily_report_id", form.id);
    if (delError) {
      toast.error("No se pudieron actualizar las actividades.");
      setSaving(false);
      return;
    }
    const toInsert = entries
      .filter((e) => e.description.trim())
      .map((e) => ({
        organization_id: form.organization_id,
        daily_report_id: form.id,
        description: e.description,
        quantity: e.quantity,
        unit: e.unit,
      }));
    if (toInsert.length) {
      const { error: insError } = await supabase
        .from("daily_report_entries")
        .insert(toInsert);
      if (insError) {
        toast.error("No se pudieron guardar las actividades.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!form) return;
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

  const pdfData: ReportPdfData | null = form
    ? {
        brand,
        project,
        report: {
          report_date: form.report_date,
          weather: form.weather,
          workforce: Number(form.workforce),
          hours: Number(form.hours),
          summary: form.summary,
          progress_note: form.progress_note,
          ai_summary: form.ai_summary,
          status: form.status,
        },
        entries,
        author: authorName,
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        {form && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>Reporte diario</SheetTitle>
              <SheetDescription>{form.report_date}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-date">Fecha</Label>
                  <input
                    id="r-date"
                    type="date"
                    className={fieldCls}
                    value={form.report_date}
                    onChange={(e) => set("report_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-status">Estado</Label>
                  <select
                    id="r-status"
                    className={fieldCls}
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as ReportStatus)}
                  >
                    {STATUS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Horas-hombre</Label>
                  <div className="flex h-9 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm">
                    <span className="font-medium tabular-nums">
                      {Number(form.hours)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      = personal × jornada
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-weather">Clima</Label>
                  <Input
                    id="r-weather"
                    value={form.weather ?? ""}
                    onChange={(e) => set("weather", e.target.value || null)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="r-summary">Resumen del día</Label>
                <textarea
                  id="r-summary"
                  rows={3}
                  className={areaCls}
                  value={form.summary ?? ""}
                  onChange={(e) => set("summary", e.target.value || null)}
                />
              </div>

              {/* Actividades */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Actividades</Label>
                  <button
                    onClick={() =>
                      setEntries((p) => [
                        ...p,
                        {
                          _id: crypto.randomUUID(),
                          description: "",
                          quantity: null,
                          unit: null,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="size-3.5" /> Actividad
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lo ejecutado hoy: descripción · cantidad · unidad — ej.{" "}
                  <span className="font-medium">“Tendido de cable THHN #12”</span> ·
                  350 · ml
                </p>
                <div className="space-y-2">
                  {entries.map((e, i) => (
                    <div key={e._id} className="flex items-center gap-2">
                      <input
                        placeholder="Descripción de la actividad"
                        className={cn(fieldCls, "min-w-0 flex-1")}
                        value={e.description}
                        onChange={(ev) => setEntry(i, { description: ev.target.value })}
                      />
                      <input
                        type="number"
                        placeholder="Cant."
                        className={cn(fieldCls, "w-20 shrink-0")}
                        value={e.quantity ?? ""}
                        onChange={(ev) =>
                          setEntry(i, {
                            quantity: ev.target.value ? Number(ev.target.value) : null,
                          })
                        }
                      />
                      <input
                        placeholder="Un."
                        className={cn(fieldCls, "w-16 shrink-0")}
                        value={e.unit ?? ""}
                        onChange={(ev) => setEntry(i, { unit: ev.target.value || null })}
                      />
                      <button
                        onClick={() =>
                          setEntries((p) => p.filter((_, idx) => idx !== i))
                        }
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  {entries.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sin actividades. Agrega una con “+ Actividad”.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="r-note">Nota de avance</Label>
                <textarea
                  id="r-note"
                  rows={2}
                  className={areaCls}
                  value={form.progress_note ?? ""}
                  onChange={(e) => set("progress_note", e.target.value || null)}
                />
              </div>

              {/* IA */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Sparkles className="size-3.5" />
                    Resumen IA · Claude Sonnet 4.6
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateAI}
                    disabled={aiLoading}
                    className="h-7"
                  >
                    {aiLoading ? "Generando…" : "Generar con IA"}
                  </Button>
                </div>
                {aiError && (
                  <p className="mt-2 text-xs text-destructive">{aiError}</p>
                )}
                <textarea
                  rows={3}
                  className={`${areaCls} mt-2`}
                  placeholder="Pulsa “Generar con IA” o escribe el resumen ejecutivo…"
                  value={form.ai_summary ?? ""}
                  onChange={(e) => set("ai_summary", e.target.value || null)}
                />
              </div>
            </div>

            <SheetFooter className="flex-row items-center justify-between gap-2 border-t">
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={remove}
              >
                <Trash2 className="size-4" />
                Eliminar
              </Button>
              <div className="flex items-center gap-2">
                {pdfData && (
                  <ReportPdfButton
                    data={pdfData}
                    fileName={`Reporte_${form.report_date}.pdf`}
                  />
                )}
                <Button onClick={save} disabled={saving || aiLoading}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
