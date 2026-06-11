import type { Database } from "@/lib/supabase/database.types";

type Cat = Database["public"]["Enums"]["cost_category"];

export const COST_CATEGORY: Record<Cat, string> = {
  labor: "Mano de obra",
  material: "Material",
  equipment: "Equipo",
  subcontract: "Subcontrato",
  other: "Otro",
};

export const COST_CATEGORY_OPTIONS = (Object.keys(COST_CATEGORY) as Cat[]).map(
  (v) => ({ v, l: COST_CATEGORY[v] }),
);

/** Normaliza texto libre de una importación a la categoría del enum. */
export function parseCategory(s: string | null | undefined): Cat {
  const t = (s ?? "").toLowerCase().trim();
  if (/(mano|labor|obra)/.test(t)) return "labor";
  if (/(cable|material|insumo)/.test(t)) return "material";
  if (/(equipo|equipment|maquin|gr[uú]a|izaje)/.test(t)) return "equipment";
  if (/(subcontrat|subcontract)/.test(t)) return "subcontract";
  return "other";
}
