// =========================================================
// Modus PM — Métricas EVM (Earned Value Management)
// PV = Valor Planificado · EV = Valor Ganado · AC = Costo Real
// SPI = EV/PV (cronograma) · CPI = EV/AC (costo)
// =========================================================

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
