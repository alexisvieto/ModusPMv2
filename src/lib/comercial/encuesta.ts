// =========================================================
// VT-F-002 — Encuesta de satisfacción del cliente (la llena el CLIENTE por
// enlace público). DOS modalidades del documento controlado — preguntas EXACTAS:
//   • suministro (venta de producto)  • obra (proyecto)
// Config compartida por el formulario público, la vista interna y el PDF.
// =========================================================

export const VT_F_002 = "VT-F-002";

export type EncuestaTipo = "suministro" | "obra";
export type Opt = { v: string; l: string };
export type Pregunta = { id: string; label: string; options: Opt[] };
export type Seccion = { titulo: string; preguntas: Pregunta[] };
export type EncuestaDef = {
  secciones: Seccion[];
  comentarios: boolean; // ¿lleva sección de comentarios? (el doc: sí en suministro)
  refLabel: string; // etiqueta del campo de contexto
};

export const ENCUESTA_TIPOS: { v: EncuestaTipo; l: string }[] = [
  { v: "suministro", l: "Suministro (venta de producto)" },
  { v: "obra", l: "Obra (proyecto)" },
];

// ── opciones reutilizables ──
const SATISF5: Opt[] = [
  { v: "muy_satisfecho", l: "Muy satisfecho" },
  { v: "satisfecho", l: "Satisfecho" },
  { v: "neutral", l: "Neutral" },
  { v: "insatisfecho", l: "Insatisfecho" },
  { v: "muy_insatisfecho", l: "Muy insatisfecho" },
];
const FACIL5: Opt[] = [
  { v: "muy_facil", l: "Muy fácil" },
  { v: "facil", l: "Fácil" },
  { v: "neutral", l: "Neutral" },
  { v: "dificil", l: "Difícil" },
  { v: "muy_dificil", l: "Muy difícil" },
];
const SI_NO_PARC: Opt[] = [
  { v: "si", l: "Sí" },
  { v: "no", l: "No" },
  { v: "parcialmente", l: "Parcialmente" },
];
const SI_NO: Opt[] = [
  { v: "si", l: "Sí" },
  { v: "no", l: "No" },
];
const SI_NO_NEUTRAL: Opt[] = [
  { v: "si", l: "Sí" },
  { v: "no", l: "No" },
  { v: "neutral", l: "Neutral" },
];
const SI_NO_TALVEZ: Opt[] = [
  { v: "si", l: "Sí" },
  { v: "no", l: "No" },
  { v: "tal_vez", l: "Tal vez" },
];
// Escala de valoración de la encuesta de OBRA (EX·MB·B·R·M·MM).
const ESCALA6: Opt[] = [
  { v: "ex", l: "Excelente" },
  { v: "mb", l: "Muy Bueno" },
  { v: "b", l: "Bueno" },
  { v: "r", l: "Regular" },
  { v: "m", l: "Malo" },
  { v: "mm", l: "Muy Malo" },
];
const rate = (id: string, label: string): Pregunta => ({ id, label, options: ESCALA6 });

export const ENCUESTAS: Record<EncuestaTipo, EncuestaDef> = {
  suministro: {
    refLabel: "Suministro / servicio",
    comentarios: true,
    secciones: [
      {
        titulo: "Atención en el proceso de venta",
        preguntas: [
          {
            id: "atencion_ventas",
            label:
              "¿Qué tan satisfecho estuvo con la atención recibida por parte de nuestro equipo de ventas?",
            options: SATISF5,
          },
          {
            id: "info_vendedor",
            label:
              "¿Considera que el vendedor le brindó la información necesaria sobre el producto?",
            options: SI_NO_PARC,
          },
          {
            id: "facilidad_compra",
            label: "¿Qué tan fácil fue el proceso de compra?",
            options: FACIL5,
          },
          {
            id: "documentacion",
            label:
              "¿Recibió toda la documentación necesaria relacionada con su compra?",
            options: SI_NO_PARC,
          },
        ],
      },
      {
        titulo: "Recepción del producto y su alcance",
        preguntas: [
          { id: "entrega_tiempo", label: "¿El producto fue entregado en el tiempo acordado?", options: SI_NO },
          {
            id: "condiciones_recepcion",
            label: "¿El producto se encontraba en perfectas condiciones al momento de la recepción?",
            options: SI_NO,
          },
          {
            id: "caracteristicas",
            label: "¿Las características del producto cumplen con lo que esperaba?",
            options: SI_NO_PARC,
          },
          {
            id: "funcionamiento",
            label: "¿El producto ha cumplido con sus expectativas en cuanto a su funcionamiento?",
            options: SI_NO_PARC,
          },
          { id: "precio_justo", label: "¿Considera que el precio del producto es justo?", options: SI_NO_NEUTRAL },
          { id: "recomendaria", label: "¿Recomendaría nuestros productos a otras personas?", options: SI_NO_TALVEZ },
        ],
      },
    ],
  },
  obra: {
    refLabel: "Obra",
    comentarios: false,
    secciones: [
      {
        titulo: "Valórenos (Excelente · Muy Bueno · Bueno · Regular · Malo · Muy Malo)",
        preguntas: [
          rate("obra_plazos", "Cumplimiento de los plazos acordados al inicio de las obras"),
          rate("obra_planos", "Respeto a los planos entregados al inicio de la obra"),
          rate("obra_conformidad", "Conformidad de los trabajos realizados"),
          rate("obra_materiales", "Los materiales cumplen con los requisitos de calidad necesarios"),
          rate("obra_trato_obra", "Trato del personal de obra de Ingesoft (peones, capataces…)"),
          rate("obra_trato_direccion", "Trato del personal con más responsabilidad de Ingesoft (Dir. Técnica, alta Dirección…)"),
          rate("obra_seguimiento", "Seguimiento de obra"),
          rate("obra_calidad_precio", "Relación Calidad/Precio"),
          rate("obra_general", "Valoración general de la obra realizada por Ingesoft"),
        ],
      },
    ],
  },
};

// Todas las preguntas de ambas modalidades (ids únicos) → para etiquetar respuestas.
export const ENCUESTA_PREGUNTAS: Pregunta[] = [
  ...ENCUESTAS.suministro.secciones,
  ...ENCUESTAS.obra.secciones,
].flatMap((s) => s.preguntas);

export function optLabel(preguntaId: string, value: string): string {
  const p = ENCUESTA_PREGUNTAS.find((q) => q.id === preguntaId);
  return p?.options.find((o) => o.v === value)?.l ?? (value || "—");
}

export function encuestaDef(tipo: string): EncuestaDef {
  return tipo === "obra" ? ENCUESTAS.obra : ENCUESTAS.suministro;
}
