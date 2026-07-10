import { notFound } from "next/navigation";
import {
  CalendarRange,
  Gauge,
  MapPin,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { SCurve } from "@/components/charts/s-curve";
import DashboardPdfButton from "@/components/dashboard/dashboard-pdf-button";
import type { DashboardPdfData } from "@/components/dashboard/dashboard-pdf-document";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatCompactCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  evm,
  HEALTH_META,
  healthFromSpi,
  ganttCurve,
  ganttSnapshot,
  latestSnapshot,
  TASK_STATUS_META,
  type Snapshot,
} from "@/lib/metrics";
import { brandFromOrg, ORG_BRAND_COLUMNS, type OrgBranding } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const PROJECT_STATUS: Record<string, string> = {
  planning: "Planificación",
  active: "Activo",
  on_hold: "En pausa",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default async function ProjectDashboard({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: snapshots },
    { data: tasks },
    { data: costs },
    { data: reports },
    { data: org },
  ] = await Promise.all([
      supabase
        .from("progress_snapshots")
        .select(
          "snapshot_date, planned_pct, actual_pct, planned_value, earned_value, actual_cost",
        )
        .eq("project_id", projectId)
        .order("snapshot_date", { ascending: true }),
      supabase
        .from("tasks")
        .select(
          "id, name, wbs, progress, status, parent_id, planned_start, planned_end, weight, sort_order",
        )
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("cost_entries")
        .select("budget, committed, actual, category")
        .eq("project_id", projectId),
      supabase
        .from("daily_reports")
        .select("id, report_date, summary, ai_summary, workforce, hours, status")
        .eq("project_id", projectId)
        .order("report_date", { ascending: false })
        .limit(1),
      supabase
        .from("organizations")
        .select(ORG_BRAND_COLUMNS)
        .eq("id", project.organization_id)
        .maybeSingle(),
    ]);

  const snaps = (snapshots ?? []) as Snapshot[];
  const brand = brandFromOrg(org as OrgBranding | null);

  const allTasks = tasks ?? [];
  const phases = allTasks.filter((t) => t.parent_id === null);
  // Proyecto plano (sin jerarquía): todas las tareas cuentan como hojas para el
  // EVM — si no, spi queda null y el proyecto se reporta "en curso" sin datos.
  const leaves0 = allTasks.filter((t) => t.parent_id !== null);
  const leaves = leaves0.length ? leaves0 : allTasks;
  const lastReport = reports?.[0] ?? null;

  const actualCost = (costs ?? []).reduce((a, c) => a + Number(c.actual ?? 0), 0);
  const budget = Number(project.budget ?? 0);
  const costPct = budget ? (actualCost / budget) * 100 : 0;
  const currency = project.currency ?? "USD";

  // EVM: usa snapshots si existen; si no, sintetiza "hoy" desde el Gantt.
  const latest =
    latestSnapshot(snaps) ??
    ganttSnapshot(
      leaves,
      project.start_date,
      project.end_date,
      budget,
      actualCost,
    );
  const m = evm(latest);
  const health = healthFromSpi(m.spi);
  const hm = HEALTH_META[health];

  const actualPct = Number(latest?.actual_pct ?? 0);
  const plannedPct = Number(latest?.planned_pct ?? 0);
  const scheduleGap = actualPct - plannedPct;

  // Curva S: snapshots si existen; si no, plan + real derivados del Gantt.
  const chartData =
    snaps.length > 0
      ? snaps.map((s) => ({
          date: s.snapshot_date,
          plan: Number(s.planned_pct),
          real: s.actual_pct === null ? null : Number(s.actual_pct),
        }))
      : ganttCurve(leaves, {
          start: project.start_date,
          end: project.end_date,
        });

  const spiTone =
    m.spi === null
      ? "text-foreground"
      : m.spi >= 0.95
        ? "text-success"
        : m.spi >= 0.85
          ? "text-warning"
          : "text-destructive";
  const cpiTone =
    m.cpi === null
      ? "text-foreground"
      : m.cpi >= 0.98
        ? "text-success"
        : m.cpi >= 0.9
          ? "text-warning"
          : "text-destructive";

  const pdfData: DashboardPdfData = {
    brand,
    project: {
      name: project.name,
      code: project.code,
      client_name: project.client_name,
      location: project.location,
      start_date: project.start_date,
      end_date: project.end_date,
      status: PROJECT_STATUS[project.status] ?? project.status,
    },
    health: hm.label,
    generatedAt: formatDate(new Date()),
    kpis: {
      actualPct,
      plannedPct,
      scheduleGap,
      spi: m.spi,
      cpi: m.cpi,
      actualCost,
      budget,
      costPct,
      currency,
    },
    curve: chartData.map((d) => ({ date: d.date, plan: d.plan, real: d.real ?? null })),
    phases: phases.map((t) => ({
      wbs: t.wbs,
      name: t.name,
      progress: Number(t.progress),
    })),
    lastReport: lastReport
      ? {
          report_date: lastReport.report_date,
          summary: lastReport.summary,
          ai_summary: lastReport.ai_summary,
          workforce: lastReport.workforce,
          hours: lastReport.hours,
        }
      : null,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      {/* ===== Header ===== */}
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                hm.className,
              )}
            >
              <span className={cn("size-1.5 rounded-full", hm.dot)} />
              {hm.label}
            </span>
            {project.code && (
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {project.code}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {PROJECT_STATUS[project.status] ?? project.status}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {project.client_name && (
              <span>
                Cliente:{" "}
                <span className="text-foreground">{project.client_name}</span>
              </span>
            )}
            {project.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {project.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="size-3.5" />
              {formatDate(project.start_date)} – {formatDate(project.end_date)}
            </span>
          </div>
        </div>
        <DashboardPdfButton
          data={pdfData}
          fileName={`Dashboard_${project.code ?? "proyecto"}.pdf`}
        />
      </header>

      {/* ===== KPIs ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Avance real"
          value={formatPercent(actualPct, 1)}
          hint={`Plan ${formatPercent(plannedPct, 1)}`}
          trend={scheduleGap}
          trendLabel={`${scheduleGap >= 0 ? "+" : ""}${formatNumber(scheduleGap, 1)} pts vs plan`}
          icon={<Gauge className="size-4 text-muted-foreground" />}
        />
        <Kpi
          label="SPI · Cronograma"
          value={m.spi === null ? "—" : m.spi.toFixed(2)}
          valueClassName={spiTone}
          hint={
            m.spi === null
              ? "Sin datos"
              : m.spi >= 1
                ? "Adelantado al plan"
                : "Detrás del plan"
          }
          icon={<CalendarRange className="size-4 text-muted-foreground" />}
        />
        <Kpi
          label="CPI · Costo"
          value={m.cpi === null ? "—" : m.cpi.toFixed(2)}
          valueClassName={cpiTone}
          hint={
            m.cpi === null
              ? "Sin datos"
              : m.cpi >= 1
                ? "Bajo presupuesto"
                : "Sobre presupuesto"
          }
          icon={<Gauge className="size-4 text-muted-foreground" />}
        />
        <Kpi
          label="Costo real"
          value={formatCompactCurrency(actualCost, currency)}
          hint={`de ${formatCompactCurrency(budget, currency)} · ${formatPercent(costPct, 0)}`}
          icon={<Receipt className="size-4 text-muted-foreground" />}
        />
      </div>

      {/* ===== Curva S + Fases ===== */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Curva S</h2>
                <p className="text-xs text-muted-foreground">
                  Avance planificado vs real (acumulado)
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

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Avance por fase</h2>
            <div className="space-y-4">
              {phases.map((t) => {
                const sm = TASK_STATUS_META[t.status] ?? TASK_STATUS_META.not_started;
                return (
                  <div key={t.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.wbs}
                        </span>
                        <span className="truncate">{t.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatNumber(Number(t.progress), 0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={Number(t.progress)} className="h-1.5" />
                      <span className={cn("size-1.5 shrink-0 rounded-full", sm.dot)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Último reporte + IA ===== */}
      {lastReport && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Último reporte diario</h2>
              <span className="text-xs text-muted-foreground">
                {formatDate(lastReport.report_date, {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-3">
                <p className="text-sm text-foreground">{lastReport.summary}</p>
                {lastReport.ai_summary && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Sparkles className="size-3.5" />
                      Resumen IA
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lastReport.ai_summary}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-row gap-3 md:flex-col">
                <div className="flex-1 rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Personal</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">
                    {formatNumber(lastReport.workforce, 0)}
                  </p>
                </div>
                <div className="flex-1 rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Horas-hombre</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">
                    {formatNumber(lastReport.hours, 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className={cn("mt-2 text-2xl font-semibold tabular-nums", valueClassName)}>
          {value}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {trend !== undefined && trendLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                trend >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {trendLabel}
            </span>
          )}
          {!trendLabel && hint ? <span>{hint}</span> : null}
          {trendLabel && hint ? (
            <span className="text-muted-foreground/70">· {hint}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
