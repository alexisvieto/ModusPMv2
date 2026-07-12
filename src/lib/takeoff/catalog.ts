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

// ── Catálogo de elementos por sistema (para el conteo de planos, F2) ──
// element_key estable + nombre + unidad + color del marcador en el visor.
export type ElementDef = {
  key: string;
  name: string;
  unit: string; // und | m | m2
  color: string; // color del marcador
  hint?: string; // rótulo típico (P, R, V, G…) — pista para leer la leyenda, no regla dura
};

export const ELEMENTS_BY_SYSTEM: Record<string, ElementDef[]> = {
  // Catálogo CERRADO de alarma contra incendio: la lectura de leyenda debe
  // mapear cada fila contra esta lista (nada fuera de aquí). Los `hint` son
  // rótulos frecuentes que orientan a la visión, no imponen el mapeo.
  alarma_incendio: [
    { key: "detector_humo", name: "Detector de humo", unit: "und", color: "#EF4444", hint: "P" },
    { key: "calor_fijo", name: "Detector de calor (fijo)", unit: "und", color: "#F97316", hint: "R" },
    { key: "calor_variable", name: "Detector de calor (variable)", unit: "und", color: "#FB923C", hint: "V" },
    { key: "detector_gas", name: "Detector de gas", unit: "und", color: "#EAB308", hint: "G" },
    { key: "estacion_manual", name: "Estación manual", unit: "und", color: "#DC2626" },
    { key: "bocina", name: "Bocina", unit: "und", color: "#3B82F6" },
    { key: "estrobo", name: "Estroboscópico", unit: "und", color: "#8B5CF6" },
    { key: "bocina_estrobo", name: "Bocina con estroboscópico", unit: "und", color: "#6366F1" },
    { key: "extintor", name: "Extintor", unit: "und", color: "#F43F5E" },
    { key: "extintor_pqs", name: "Extintor PQS", unit: "und", color: "#B91C1C" },
    { key: "extintor_co2", name: "Extintor CO₂", unit: "und", color: "#9333EA" },
    { key: "extintor_k", name: "Extintor clase K", unit: "und", color: "#C026D3" },
    { key: "panel_paci", name: "Panel ACI (PACI)", unit: "und", color: "#1F2937", hint: "PACI / CPACI" },
    { key: "panel_evac", name: "Panel/módulo de evacuación", unit: "und", color: "#0F766E", hint: "EVAC" },
    { key: "anunciador", name: "Anunciador remoto", unit: "und", color: "#0EA5E9" },
    { key: "modulo_mr", name: "Módulo de control/relé (MR)", unit: "und", color: "#10B981", hint: "MR" },
    { key: "modulo_mx", name: "Módulo de monitoreo (MX)", unit: "und", color: "#14B8A6", hint: "MX" },
    { key: "modulo_mz", name: "Módulo de zona (MZ)", unit: "und", color: "#0D9488", hint: "MZ" },
    { key: "modulo_as", name: "Detección por aspiración (ASD)", unit: "und", color: "#22D3EE", hint: "AS" },
    { key: "tuberia_aci", name: "Tubería ACI", unit: "m", color: "#64748B", hint: "ACI" },
    { key: "detector_sin_clasificar", name: "Detector sin clasificar", unit: "und", color: "#94A3B8" },
    { key: "otro", name: "Otro dispositivo", unit: "und", color: "#6B7280" },
  ],
  cctv: [
    { key: "camara_domo", name: "Cámara domo", unit: "und", color: "#3B82F6" },
    { key: "camara_bala", name: "Cámara bala", unit: "und", color: "#6366F1" },
    { key: "nvr", name: "NVR / grabador", unit: "und", color: "#1F2937" },
    { key: "otro", name: "Otro dispositivo", unit: "und", color: "#6B7280" },
  ],
  cableado_estructurado: [
    { key: "salida_datos", name: "Salida de datos", unit: "und", color: "#3B82F6" },
    { key: "salida_doble", name: "Salida doble", unit: "und", color: "#6366F1" },
    { key: "rack", name: "Rack / gabinete", unit: "und", color: "#1F2937" },
    { key: "otro", name: "Otro dispositivo", unit: "und", color: "#6B7280" },
  ],
};

export function elementsFor(systemType: string): ElementDef[] {
  return ELEMENTS_BY_SYSTEM[systemType] ?? ELEMENTS_BY_SYSTEM.alarma_incendio;
}
