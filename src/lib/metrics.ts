// =========================================================
// Modus PM — Métricas EVM (Earned Value Management)
// PV = Valor Planificado · EV = Valor Ganado · AC = Costo Real
// SPI = EV/PV (cronograma) · CPI = EV/AC (costo)
// =========================================================

import { parseISODate, toISODate } from "@/lib/calendar";

export type Snapshot = {
  snapshot_date: string;
  planned_pct: number;
  actual_pct: number | null;
  planned_value: number;
  earned_value: number | null;
  actual_cost: number | null;
};

export type Health = "on_track" | "at_risk" | "delayed";

export function latestSnapshot(snaps: Snapshot[]): Snapshot | null {
  if (!snaps.length) return null;
  return [...snaps].sort((a, b) =>
    a.snapshot_date < b.snapshot_date ? -1 : 1,
  )[snaps.length - 1];
}

export function evm(snap: Snapshot | null) {
  const pv = snap?.planned_value ?? 0;
  const ev = snap?.earned_value ?? 0;
  const ac = snap?.actual_cost ?? 0;
  return {
    pv,
    ev,
    ac,
    spi: pv ? ev / pv : null,
    cpi: ac ? ev / ac : null,
    sv: ev - pv, // Schedule Variance
    cv: ev - ac, // Cost Variance
  };
}

/** Salud del proyecto a partir del SPI (umbrales calmados). */
export function healthFromSpi(spi: number | null): Health {
  if (spi === null) return "on_track";
  if (spi >= 0.95) return "on_track";
  if (spi >= 0.85) return "at_risk";
  return "delayed";
}

export const HEALTH_META: Record<
  Health,
  { label: string; className: string; dot: string }
> = {
  on_track: {
    label: "En curso",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
  at_risk: {
    label: "En riesgo",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  delayed: {
    label: "Retrasado",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export const TASK_STATUS_META: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  not_started: {
    label: "Sin iniciar",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  in_progress: {
    label: "En curso",
    className: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  completed: {
    label: "Completado",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
  delayed: {
    label: "Retrasado",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export type CurvePoint = { date: string; plan: number; real: number | null };

type CurveTask = {
  planned_start: string | null;
  planned_end: string | null;
  progress: number | null;
  weight: number | null;
};

const DAY = 86400000;
const wOf = (t: { weight: number | null }) => Number(t.weight) || 1;
const progOf = (t: { progress: number | null }) =>
  Math.min(Math.max(Number(t.progress) || 0, 0), 100) / 100;

/** Fracción 0..1 del peso planificado de la tarea al día d (lineal en su ventana). */
function planFrac(t: CurveTask, d: Date): number {
  const s = parseISODate(t.planned_start as string);
  const e = parseISODate(t.planned_end as string);
  const span = Math.max(1, Math.round((+e - +s) / DAY) + 1);
  const elapsed = Math.round((+d - +s) / DAY) + 1;
  return Math.max(0, Math.min(1, elapsed / span));
}

/**
 * Curva S derivada del Gantt: línea PLAN (fechas planificadas) vs línea REAL
 * (cada tarea aporta su peso × su % de avance). Sin avance, la real queda en 0;
 * con todo al 100%, real = plan.
 */
export function ganttCurve(
  tasks: CurveTask[],
  range: { start: string | null; end: string | null },
): CurvePoint[] {
  const valid = tasks.filter((t) => t.planned_start && t.planned_end);
  if (valid.length === 0 || !range.start || !range.end) return [];

  const totalW = valid.reduce((a, t) => a + wOf(t), 0) || 1;
  const start = parseISODate(range.start);
  const end = parseISODate(range.end);
  const totalDays = Math.max(1, Math.round((+end - +start) / DAY) + 1);
  const step = Math.max(1, Math.ceil(totalDays / 16));
  const addDays = (b: Date, n: number) =>
    new Date(b.getFullYear(), b.getMonth(), b.getDate() + n);

  const points: CurvePoint[] = [];
  const pushAt = (d: Date) => {
    let plan = 0;
    let real = 0;
    for (const t of valid) {
      const pf = planFrac(t, d);
      plan += pf * wOf(t);
      real += pf * wOf(t) * progOf(t);
    }
    points.push({
      date: toISODate(d),
      plan: Math.round((plan / totalW) * 1000) / 10,
      real: Math.round((real / totalW) * 1000) / 10,
    });
  };

  for (let i = 0; i < totalDays; i += step) pushAt(addDays(start, i));
  if (!points.length || points[points.length - 1].date !== toISODate(end))
    pushAt(end);
  return points;
}

/** "Snapshot" sintético de hoy (para KPIs SPI/CPI/avance) derivado del Gantt. */
export function ganttSnapshot(
  tasks: CurveTask[],
  start: string | null,
  end: string | null,
  budget: number,
  actualCost: number,
  now: Date = new Date(),
): Snapshot | null {
  const valid = tasks.filter((t) => t.planned_start && t.planned_end);
  if (valid.length === 0 || !start || !end) return null;

  const totalW = valid.reduce((a, t) => a + wOf(t), 0) || 1;
  const s = parseISODate(start);
  const e = parseISODate(end);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ref: Date | null = +today < +s ? null : +today > +e ? e : today;

  const planW = ref
    ? valid.reduce((a, t) => a + planFrac(t, ref) * wOf(t), 0)
    : 0;
  const realW = valid.reduce((a, t) => a + wOf(t) * progOf(t), 0);
  const planned_pct = Math.round((planW / totalW) * 1000) / 10;
  const actual_pct = Math.round((realW / totalW) * 1000) / 10;

  return {
    snapshot_date: toISODate(today),
    planned_pct,
    actual_pct,
    planned_value: (budget * planned_pct) / 100,
    earned_value: (budget * actual_pct) / 100,
    actual_cost: actualCost,
  };
}
