import { parseISODate } from "@/lib/calendar";
import type { Database } from "@/lib/supabase/database.types";

export type PunchPriority = Database["public"]["Enums"]["punch_priority"];
export type PunchStatus = Database["public"]["Enums"]["punch_status"];

export const PRIORITY_META: Record<
  PunchPriority,
  { label: string; className: string; dot: string; weight: number }
> = {
  high: {
    label: "Alta",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    weight: 3,
  },
  medium: {
    label: "Media",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
    weight: 2,
  },
  low: {
    label: "Baja",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    weight: 1,
  },
};

export const PRIORITY_OPTIONS: { v: PunchPriority; l: string }[] = [
  { v: "low", l: "Baja" },
  { v: "medium", l: "Media" },
  { v: "high", l: "Alta" },
];

export const STATUS_META: Record<
  PunchStatus,
  { label: string; className: string; dot: string }
> = {
  open: {
    label: "Abierto",
    className: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  in_progress: {
    label: "En progreso",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  done: {
    label: "Resuelto",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
};

export const STATUS_OPTIONS: { v: PunchStatus; l: string }[] = [
  { v: "open", l: "Abierto" },
  { v: "in_progress", l: "En progreso" },
  { v: "done", l: "Resuelto" },
];

/** Días desde hoy hasta `due` (negativo = vencido). Determinista por fecha local. */
export function daysUntil(due: string, from: Date = new Date()): number {
  const d = parseISODate(due);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

export type DueState = "none" | "ok" | "soon" | "overdue";

export function dueState(
  item: { status: PunchStatus; due_date: string | null },
  from: Date = new Date(),
): DueState {
  if (!item.due_date) return "none";
  if (item.status === "done") return "ok";
  const n = daysUntil(item.due_date, from);
  if (n < 0) return "overdue";
  if (n <= 2) return "soon";
  return "ok";
}

/** Vencido o por vencer en ≤2 días, y no resuelto → dispara la alarma. */
export function isAlerting(
  item: { status: PunchStatus; due_date: string | null },
  from: Date = new Date(),
): boolean {
  if (item.status === "done" || !item.due_date) return false;
  return daysUntil(item.due_date, from) <= 2;
}

export function dueLabel(due: string, from: Date = new Date()): string {
  const n = daysUntil(due, from);
  if (n < 0) {
    const a = Math.abs(n);
    return `Vencido hace ${a} ${a === 1 ? "día" : "días"}`;
  }
  if (n === 0) return "Vence hoy";
  if (n === 1) return "Vence mañana";
  return `Vence en ${n} días`;
}
