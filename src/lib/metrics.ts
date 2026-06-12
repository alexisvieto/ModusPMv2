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

/**
 * Curva S planificada derivada del Gantt: cada tarea hoja aporta su peso
 * distribuido linealmente entre su inicio y su fin planificados; el acumulado
 * normalizado da el % planificado a lo largo del tiempo. `real` queda en null
 * (se llena con el avance real cuando el proyecto arranca y se reporta).
 */
export function plannedCurve(
  tasks: {
    planned_start: string | null;
    planned_end: string | null;
    weight: number | null;
  }[],
  range: { start: string | null; end: string | null },
): CurvePoint[] {
  const valid = tasks.filter((t) => t.planned_start && t.planned_end);
  if (valid.length === 0 || !range.start || !range.end) return [];

  const DAY = 86400000;
  const totalW = valid.reduce((a, t) => a + (Number(t.weight) || 1), 0) || 1;
  const start = parseISODate(range.start);
  const end = parseISODate(range.end);
  const totalDays = Math.max(1, Math.round((+end - +start) / DAY) + 1);
  const step = Math.max(1, Math.ceil(totalDays / 16));

  const addDays = (base: Date, n: number) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

  const points: CurvePoint[] = [];
  const pushAt = (d: Date) => {
    const cum = valid.reduce((acc, t) => {
      const ts = parseISODate(t.planned_start as string);
      const te = parseISODate(t.planned_end as string);
      const span = Math.max(1, Math.round((+te - +ts) / DAY) + 1);
      const elapsed = Math.round((+d - +ts) / DAY) + 1;
      const frac = Math.max(0, Math.min(1, elapsed / span));
      return acc + frac * (Number(t.weight) || 1);
    }, 0);
    points.push({
      date: toISODate(d),
      plan: Math.round((cum / totalW) * 1000) / 10,
      real: null,
    });
  };

  for (let i = 0; i < totalDays; i += step) pushAt(addDays(start, i));
  const lastIso = toISODate(end);
  if (!points.length || points[points.length - 1].date !== lastIso) pushAt(end);
  return points;
}
