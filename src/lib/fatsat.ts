import type { Database } from "@/lib/supabase/database.types";

export type FatsatResult = Database["public"]["Enums"]["fatsat_result"];
export type FatsatStatus = Database["public"]["Enums"]["fatsat_status"];

export const RESULT_OPTIONS: { v: FatsatResult; l: string }[] = [
  { v: "pending", l: "Pendiente" },
  { v: "pass", l: "Aprobado" },
  { v: "fail", l: "Fallido" },
  { v: "na", l: "N/A" },
];

export const RESULT_LABEL: Record<FatsatResult, string> = {
  pending: "Pendiente",
  pass: "Aprobado",
  fail: "Fallido",
  na: "N/A",
};

/** Clases del botón de estado: coloreado y "lleno" cuando está activo. */
export function resultButtonClass(result: FatsatResult, active: boolean): string {
  if (!active) return "border-border text-muted-foreground hover:bg-muted";
  switch (result) {
    case "pass":
      return "border-success/40 bg-success/15 text-success";
    case "fail":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    case "na":
      return "border-border bg-muted text-foreground";
    default:
      return "border-warning/40 bg-warning/15 text-warning"; // pending
  }
}

export type ResultCount = {
  total: number;
  pass: number;
  fail: number;
  na: number;
  pending: number;
};

export function countResults(items: { result: FatsatResult }[]): ResultCount {
  const c: ResultCount = { total: items.length, pass: 0, fail: 0, na: 0, pending: 0 };
  for (const i of items) c[i.result] += 1;
  return c;
}

export const STATUS_META: Record<
  FatsatStatus,
  { label: string; className: string; dot: string }
> = {
  draft: {
    label: "Borrador",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  in_progress: {
    label: "En ejecución",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  approved: {
    label: "Aprobada",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
  approved_with_observations: {
    label: "Aprobada c/ obs.",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  rejected: {
    label: "Con fallos",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

/** Estado de la prueba en campo derivado de sus pruebas relacionadas. */
export function deriveStatus(
  items: { result: FatsatResult; notes?: string | null }[],
): FatsatStatus {
  if (items.length === 0) return "draft";
  const c = countResults(items);
  if (c.fail > 0) return "rejected";
  if (c.pending > 0) return "in_progress";
  if (items.some((i) => i.notes && i.notes.trim()))
    return "approved_with_observations";
  return "approved";
}
