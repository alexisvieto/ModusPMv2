"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ListChecks, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ReportEditorSheet } from "@/components/reports/report-editor-sheet";
import { toISODate } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

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

const STATUS: Record<string, { label: string; className: string; dot: string }> = {
  draft: {
    label: "Borrador",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  submitted: {
    label: "Enviado",
    className: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  approved: {
    label: "Aprobado",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
};

export function ReportBoard({
  project,
  reports,
  profiles,
  currentUserId,
  brand,
}: {
  project: Project;
  reports: ReportWithEntries[];
  profiles: { id: string; full_name: string | null }[];
  currentUserId: string | null;
  brand: Brand;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Report | null>(null);
  const [editingEntries, setEditingEntries] = useState<EntryRow[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

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
    setOpen(true);
  }

  async function addReport() {
    if (creating) return;
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("daily_reports")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        report_date: toISODate(new Date()),
        author_id: currentUserId,
        workforce: 0,
        hours: 0,
        status: "draft",
      })
      .select()
      .maybeSingle();
    setCreating(false);
    if (error || !data) {
      toast.error("No se pudo crear el reporte.");
      return;
    }
    router.refresh();
    setEditing(data);
    setEditingEntries([]);
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {reports.length} {reports.length === 1 ? "reporte" : "reportes"}
        </p>
        <Button size="sm" onClick={addReport} disabled={creating}>
          <Plus className="size-4" />
          Nuevo reporte
        </Button>
      </div>

      <div className="space-y-3">
        {reports.map((r) => {
          const sm = STATUS[r.status] ?? STATUS.draft;
          return (
            <button
              key={r.id}
              onClick={() => openReport(r)}
              className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
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
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    sm.className,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", sm.dot)} />
                  {sm.label}
                </span>
              </div>

              {r.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {r.summary}
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

        {reports.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-sm text-muted-foreground">
            Aún no hay reportes diarios.
            <Button size="sm" onClick={addReport} disabled={creating}>
              <Plus className="size-4" />
              Crear el primero
            </Button>
          </div>
        )}
      </div>

      <ReportEditorSheet
        report={editing}
        initialEntries={editingEntries}
        project={{
          name: project.name,
          code: project.code,
          client_name: project.client_name,
        }}
        authorName={editing?.author_id ? (nameOf.get(editing.author_id) ?? null) : null}
        open={open}
        onOpenChange={setOpen}
        brand={brand}
      />
    </>
  );
}
