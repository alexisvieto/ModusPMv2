import type { Database } from "@/lib/supabase/database.types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; className: string; dot: string }
> = {
  planning: {
    label: "Planificación",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  active: {
    label: "En ejecución",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
  on_hold: {
    label: "En pausa",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  completed: {
    label: "Completado",
    className: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export const PROJECT_STATUS_OPTIONS: { v: ProjectStatus; l: string }[] = [
  { v: "planning", l: "Planificación" },
  { v: "active", l: "En ejecución" },
  { v: "on_hold", l: "En pausa" },
  { v: "completed", l: "Completado" },
  { v: "cancelled", l: "Cancelado" },
];
