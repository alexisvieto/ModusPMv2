// Catálogo de tipos de sistema del módulo de cálculo (extensible).
// Client-safe: solo constantes.

export type SystemType =
  | "alarma_incendio"
  | "alarma_robo"
  | "cctv"
  | "control_acceso"
  | "cableado_estructurado"
  | "electrico"
  | "otro";

export const SYSTEM_TYPES: { v: SystemType; l: string }[] = [
  { v: "alarma_incendio", l: "Alarma contra incendio" },
  { v: "alarma_robo", l: "Alarma contra robo" },
  { v: "cctv", l: "Video vigilancia (CCTV)" },
  { v: "control_acceso", l: "Control de acceso" },
  { v: "cableado_estructurado", l: "Cableado estructurado" },
  { v: "electrico", l: "Eléctrico" },
  { v: "otro", l: "Otro sistema" },
];

export const SYSTEM_LABEL: Record<string, string> = Object.fromEntries(
  SYSTEM_TYPES.map((s) => [s.v, s.l]),
);

// Categorías del desglose del pliego (técnico + riesgos)
export const SCOPE_TECH_CATEGORIES = [
  "alcance",
  "tarea",
  "equipo",
  "norma",
  "entregable",
] as const;

export const SCOPE_RISK_CATEGORIES = [
  "horario",
  "seguro_fianza",
  "laboral_sindical",
  "multa_penalizacion",
  "condicion_sitio",
  "condicion_pago",
  "riesgo_otro",
] as const;

export const SCOPE_CATEGORY_LABEL: Record<string, string> = {
  alcance: "Alcance",
  tarea: "Tarea específica",
  equipo: "Equipo especificado",
  norma: "Norma / estándar",
  entregable: "Entregable",
  horario: "Horarios de trabajo",
  seguro_fianza: "Seguros y fianzas",
  laboral_sindical: "Laboral / sindical",
  multa_penalizacion: "Multas y penalizaciones",
  condicion_sitio: "Condiciones de sitio",
  condicion_pago: "Condiciones de pago",
  riesgo_otro: "Otro riesgo",
};

export const isRiskCategory = (c: string) =>
  (SCOPE_RISK_CATEGORIES as readonly string[]).includes(c);
