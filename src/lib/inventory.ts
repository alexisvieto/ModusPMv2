import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["inventory_status"];
type Loc = Database["public"]["Enums"]["inventory_location"];
type Cat = Database["public"]["Enums"]["inventory_category"];

export const INV_STATUS: Record<
  Status,
  { label: string; className: string; dot: string }
> = {
  por_recibir: {
    label: "Por recibir",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  instalado: {
    label: "Instalado",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
  faltante: {
    label: "Faltante",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  defectuoso: {
    label: "Defectuoso",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  spare: {
    label: "Spare",
    className: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
};

export const INV_LOCATION: Record<Loc, string> = {
  en_proyecto: "En proyecto",
  en_galera: "En galera",
};

export const INV_CATEGORY: Record<Cat, string> = {
  equipo: "Equipo",
  material: "Material",
  cable: "Cable",
  repuesto: "Repuesto",
  consumible: "Consumible",
};

export const STATUS_OPTIONS = (Object.keys(INV_STATUS) as Status[]).map((v) => ({
  v,
  l: INV_STATUS[v].label,
}));
export const LOCATION_OPTIONS = (Object.keys(INV_LOCATION) as Loc[]).map((v) => ({
  v,
  l: INV_LOCATION[v],
}));
export const CATEGORY_OPTIONS = (Object.keys(INV_CATEGORY) as Cat[]).map((v) => ({
  v,
  l: INV_CATEGORY[v],
}));
