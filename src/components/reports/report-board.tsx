"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ListChecks, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ReportEditorDialog,
  type TaskLite,
} from "@/components/reports/report-editor-dialog";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Brand } from "@/lib/brand";

type Report = Database["public"]["Tables"]["daily_reports"]["Row"];
type EntryRow = { description: string; quantity: number | null; unit: string | null };
type ReportWithEntries = Report & { daily_report_entries: EntryRow[] };
type Project = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  client_name: string | null;
};

export function ReportBoard({
  project,
  reports,
  profiles,
  tasks,
  currentUserId,
  brand,
  totalCount,
  pageSize,
}: {
  project: Project;
  reports: ReportWithEntries[];
  profiles: { id: string; full_name: string | null }[];
  tasks: TaskLite[];
  currentUserId: string | null;
  brand: Brand;
  totalCount: number;
  pageSize: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Report | null>(null);
  const [editingEntries, setEditingEntries] = useState<EntryRow[]>([]);
  const [open, setOpen] = useState(false);
  // El editor se remonta en cada apertura (estado limpio por sesión de edición).
  const [editorKey, setEditorKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reportes cargados (última página + "Cargar más"). Al refrescar el server
  // (realtime/edición) los props cambian y se resincroniza a la primera página.
  const [rows, setRows] = useState(reports);
  const [prevReports, setPrevReports] = useState(reports);
  if (prevReports !== reports) {
    setPrevReports(reports);
    setRows(reports);
  }

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name ?? "—");
    return m;
  }, [profiles]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`reports-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_reports",
          filter: `project_id=eq.${project.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, router]);

  function openReport(r: ReportWithEntries) {
    setEditing(r);
    setEditingEntries(r.daily_report_entries ?? []);
    setEditorKey((k) => k + 1);
    setOpen(true);
  }

  // El reporte NUEVO no se inserta en BD al abrir: se crea recién al Guardar.
  function addReport() {
    setEditing(null);
    setEditingEntries([]);
    setEditorKey((k) => k + 1);
    setOpen(true);
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const from = rows.length;
    const { data, error } = await createClient()
      .from("daily_reports")
      .select("*, daily_report_entries(description, quantity, unit)")
      .eq("project_id", project.id)
      .order("report_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);
    setLoadingMore(false);
    if (error) {
      toast.error("No se pudieron cargar más reportes.");
      return;
    }
    setRows((r) => [...r, ...(data ?? [])]);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} {totalCount === 1 ? "reporte" : "reportes"}
        </p>
        <Button size="sm" onClick={addReport}>
          <Plus className="size-4" />
          Nuevo reporte
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          return (
            <button
              key={r.id}
              onClick={() => openReport(r)}
              className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="font-medium capitalize">
                  {formatDate(r.report_date, {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </p>
                {r.author_id && (
                  <p className="text-xs text-muted-foreground">
                    {nameOf.get(r.author_id) ?? "—"}
                  </p>
                )}
              </div>

              {(r.ai_summary || r.summary) && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {r.ai_summary || r.summary}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {r.workforce}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {r.hours} hh
                </span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="size-3.5" />
                  {r.daily_report_entries?.length ?? 0} actividades
                </span>
                {r.ai_summary && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Sparkles className="size-3.5" />
                    IA
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-sm text-muted-foreground">
            Aún no hay reportes diarios.
            <Button size="sm" onClick={addReport}>
              <Plus className="size-4" />
              Crear el primero
            </Button>
          </div>
        )}

        {rows.length < totalCount && (
          <div className="pt-1 text-center">
            <Button
              size="sm"
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? "Cargando…"
                : `Cargar reportes anteriores (${rows.length} de ${totalCount})`}
            </Button>
          </div>
        )}
      </div>

      <ReportEditorDialog
        key={editorKey}
        report={editing}
        initialEntries={editingEntries}
        project={project}
        tasks={tasks}
        lastReportDate={rows[0]?.report_date ?? null}
        authorName={
          editing?.author_id
            ? (nameOf.get(editing.author_id) ?? null)
            : currentUserId
              ? (nameOf.get(currentUserId) ?? null)
              : null
        }
        currentUserId={currentUserId}
        open={open}
        onOpenChange={setOpen}
        brand={brand}
      />
    </>
  );
}
