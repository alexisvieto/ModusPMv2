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
};

export const ELEMENTS_BY_SYSTEM: Record<string, ElementDef[]> = {
  alarma_incendio: [
    { key: "detector_humo", name: "Detector de humo", unit: "und", color: "#EF4444" },
    { key: "detector_temp", name: "Detector de temperatura", unit: "und", color: "#F97316" },
    { key: "detector_gas", name: "Detector de gas", unit: "und", color: "#EAB308" },
    { key: "estacion_manual", name: "Estación manual", unit: "und", color: "#DC2626" },
    { key: "bocina", name: "Bocina", unit: "und", color: "#3B82F6" },
    { key: "estrobo", name: "Estroboscópico", unit: "und", color: "#8B5CF6" },
    { key: "bocina_estrobo", name: "Bocina con estroboscópico", unit: "und", color: "#6366F1" },
    { key: "modulo_monitoreo", name: "Módulo de monitoreo", unit: "und", color: "#14B8A6" },
    { key: "modulo_control", name: "Módulo de control", unit: "und", color: "#10B981" },
    { key: "panel", name: "Panel de control", unit: "und", color: "#1F2937" },
    { key: "extintor_pqs", name: "Extintor PQS", unit: "und", color: "#B91C1C" },
    { key: "extintor_co2", name: "Extintor CO₂", unit: "und", color: "#9333EA" },
    { key: "extintor_k", name: "Extintor clase K", unit: "und", color: "#C026D3" },
    { key: "tuberia_aci", name: "Tubería ACI", unit: "m", color: "#64748B" },
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
