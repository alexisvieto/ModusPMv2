// =========================================================
// Formato VT-F-004 — Visita Técnica a Cliente.
// Código fijo VT-F-004; el nº lo genera el motor ("Visita Técnica 0001").
// =========================================================

export const VT_F_004 = "VT-F-004";

export type Frecuencia =
  | "mensual"
  | "trimestral"
  | "semestral"
  | "anual"
  | "otros"
  | "";

export const FRECUENCIA_OPTS: { v: Exclude<Frecuencia, "">; l: string }[] = [
  { v: "mensual", l: "Mensual" },
  { v: "trimestral", l: "Trimestral" },
  { v: "semestral", l: "Semestral" },
  { v: "anual", l: "Anual" },
  { v: "otros", l: "Otros" },
];

export type PersonaSimple = { nombre: string; cargo: string };
export type TemaVt = { punto: string; responsable: string; fecha: string };

export type VtF004Data = {
  fecha: string;
  cliente: string;
  objetivos: string;
  frecuencia: Frecuencia;
  frecuencia_otros: string;
  personal_ingesoft: PersonaSimple[];
  personal_cliente: PersonaSimple[];
  obs_estructurales: string;
  obs_tecnicas: string;
  obs_condiciones: string;
  obs_otras: string;
  temas: TemaVt[];
};

export function emptyVtF004(): VtF004Data {
  return {
    fecha: "",
    cliente: "",
    objetivos: "",
    frecuencia: "",
    frecuencia_otros: "",
    personal_ingesoft: [{ nombre: "", cargo: "" }],
    personal_cliente: [{ nombre: "", cargo: "" }],
    obs_estructurales: "",
    obs_tecnicas: "",
    obs_condiciones: "",
    obs_otras: "",
    temas: [{ punto: "", responsable: "", fecha: "" }],
  };
}

const persArr = (v: unknown, fallback: PersonaSimple[]): PersonaSimple[] =>
  Array.isArray(v) && v.length
    ? v.map((p) => ({
        nombre: (p as PersonaSimple)?.nombre ?? "",
        cargo: (p as PersonaSimple)?.cargo ?? "",
      }))
    : fallback;

export function toVtF004(raw: unknown): VtF004Data {
  const d = (raw ?? {}) as Partial<VtF004Data>;
  const base = emptyVtF004();
  return {
    fecha: d.fecha ?? "",
    cliente: d.cliente ?? "",
    objetivos: d.objetivos ?? "",
    frecuencia: (d.frecuencia as Frecuencia) ?? "",
    frecuencia_otros: d.frecuencia_otros ?? "",
    personal_ingesoft: persArr(d.personal_ingesoft, base.personal_ingesoft),
    personal_cliente: persArr(d.personal_cliente, base.personal_cliente),
    obs_estructurales: d.obs_estructurales ?? "",
    obs_tecnicas: d.obs_tecnicas ?? "",
    obs_condiciones: d.obs_condiciones ?? "",
    obs_otras: d.obs_otras ?? "",
    temas:
      Array.isArray(d.temas) && d.temas.length
        ? d.temas.map((t) => ({
            punto: t?.punto ?? "",
            responsable: t?.responsable ?? "",
            fecha: t?.fecha ?? "",
          }))
        : base.temas,
  };
}
