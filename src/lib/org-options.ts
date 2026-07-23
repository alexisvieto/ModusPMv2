// =========================================================
// Opciones de alta de organización compartidas entre el
// server action (validación) y el formulario (UI). Módulo
// normal (no "use server") para poder exportar constantes.
// =========================================================

/** Rubros que puede escoger un tenant. La UI ofrece exactamente estos. */
export const INDUSTRIES = [
  "Telecomunicaciones",
  "Infraestructura",
  "Sistemas Especiales",
  "Proyectos Eléctricos",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** Paleta de marca lista: primario, acento y oscuro (para encabezados). */
export type BrandPreset = {
  label: string;
  primary: string;
  accent: string;
  dark: string;
};

/**
 * Paletas predefinidas para que el nuevo tenant escoja con un clic.
 * Suficientes tonos (naranja, azules, verdes, etc.); siempre puede
 * afinar a mano con "personalizar".
 */
export const BRAND_PRESETS: BrandPreset[] = [
  { label: "Naranja", primary: "#EA6A2A", accent: "#F59E0B", dark: "#1F2937" },
  { label: "Azul marino", primary: "#1D4ED8", accent: "#3B82F6", dark: "#0F172A" },
  { label: "Azul claro", primary: "#0EA5E9", accent: "#38BDF8", dark: "#0C4A6E" },
  { label: "Teal", primary: "#0F766E", accent: "#14B8A6", dark: "#1F2937" },
  { label: "Verde", primary: "#15803D", accent: "#22C55E", dark: "#14532D" },
  { label: "Índigo", primary: "#4338CA", accent: "#6366F1", dark: "#1E1B4B" },
  { label: "Púrpura", primary: "#7C3AED", accent: "#A78BFA", dark: "#2E1065" },
  { label: "Vino", primary: "#B91C1C", accent: "#EF4444", dark: "#450A0A" },
  { label: "Ámbar", primary: "#B45309", accent: "#F59E0B", dark: "#292524" },
  { label: "Grafito", primary: "#334155", accent: "#64748B", dark: "#0F172A" },
];
