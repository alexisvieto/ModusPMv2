"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectCreateSheet } from "@/components/projects/project-create-sheet";
import { PROJECT_STATUS_META, type ProjectStatus } from "@/lib/projects";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  code: string | null;
  client_name: string | null;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  currency: string;
  budget: number;
};

type Tab = "live" | "done" | "all";

export function ProjectHub({
  projects,
  orgId,
}: {
  projects: Project[];
  orgId: string | null;
}) {
  const [tab, setTab] = useState<Tab>("live");
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(
    () => ({
      live: projects.filter(
        (p) => p.status !== "completed" && p.status !== "cancelled",
      ).length,
      done: projects.filter((p) => p.status === "completed").length,
      all: projects.length,
    }),
    [projects],
  );

  const visible = useMemo(
    () =>
      projects.filter((p) => {
        if (tab === "live")
          return p.status !== "completed" && p.status !== "cancelled";
        if (tab === "done") return p.status === "completed";
        return true;
      }),
    [projects, tab],
  );

  const tabs: { k: Tab; label: string; n: number }[] = [
    { k: "live", label: "En ejecución", n: counts.live },
    { k: "done", label: "Completados", n: counts.done },
    { k: "all", label: "Todos", n: counts.all },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Cartera de proyectos de la organización — entra a uno o crea uno
            nuevo.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!orgId}>
          <Plus className="size-4" />
          Nuevo proyecto
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              tab === t.k
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label} ({t.n})
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const sm = PROJECT_STATUS_META[p.status];
          return (
            <Link
              key={p.id}
              href={`/app/proyectos/${p.id}`}
              className="group flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    sm.className,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", sm.dot)} />
                  {sm.label}
                </span>
                {p.code && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.code}
                  </span>
                )}
              </div>

              <h3 className="mt-3 font-semibold leading-snug group-hover:text-primary">
                {p.name}
              </h3>
              {p.client_name && (
                <p className="text-sm text-muted-foreground">{p.client_name}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {(p.start_date || p.end_date) && (
                  <span>
                    {p.start_date ? formatDate(p.start_date) : "—"} →{" "}
                    {p.end_date ? formatDate(p.end_date) : "—"}
                  </span>
                )}
                {p.location && <span>{p.location}</span>}
              </div>

              {Number(p.budget) > 0 && (
                <p className="mt-3 text-sm font-semibold tabular-nums">
                  {formatCurrency(Number(p.budget), p.currency)}
                </p>
              )}
            </Link>
          );
        })}

        {visible.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-sm text-muted-foreground">
            No hay proyectos en esta vista.
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!orgId}
            >
              <Plus className="size-4" />
              Crear proyecto
            </Button>
          </div>
        )}
      </div>

      <ProjectCreateSheet
        orgId={orgId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
