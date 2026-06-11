import type { Database } from "@/lib/supabase/database.types";

export type FatsatType = Database["public"]["Enums"]["fatsat_type"];
export type FatsatStatus = Database["public"]["Enums"]["fatsat_status"];
export type FatsatResult = Database["public"]["Enums"]["fatsat_result"];

export const TYPE_META: Record<FatsatType, { label: string; full: string }> = {
  fat: { label: "FAT", full: "Factory Acceptance Test — pruebas en fábrica" },
  sat: { label: "SAT", full: "Site Acceptance Test — pruebas en sitio" },
};

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
    className: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  approved: {
    label: "Aprobado",
    className: "bg-success/10 text-success",
    dot: "bg-success",
  },
  approved_with_observations: {
    label: "Aprobado c/ obs.",
    className: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  rejected: {
    label: "Rechazado",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export const STATUS_OPTIONS: { v: FatsatStatus; l: string }[] = [
  { v: "draft", l: "Borrador" },
  { v: "in_progress", l: "En ejecución" },
  { v: "approved", l: "Aprobado" },
  { v: "approved_with_observations", l: "Aprobado con observaciones" },
  { v: "rejected", l: "Rechazado" },
];

export const RESULT_META: Record<
  FatsatResult,
  { label: string; short: string; className: string }
> = {
  pending: {
    label: "Pendiente",
    short: "Pend.",
    className: "bg-muted text-muted-foreground",
  },
  pass: { label: "Aprobado", short: "OK", className: "bg-success/10 text-success" },
  fail: {
    label: "Rechazado",
    short: "Falla",
    className: "bg-destructive/10 text-destructive",
  },
  na: { label: "N/A", short: "N/A", className: "bg-muted text-muted-foreground" },
};

export const RESULT_OPTIONS: { v: FatsatResult; l: string }[] = [
  { v: "pending", l: "Pendiente" },
  { v: "pass", l: "Aprobado" },
  { v: "fail", l: "Rechazado" },
  { v: "na", l: "N/A" },
];

export type ResultCount = {
  total: number;
  pass: number;
  fail: number;
  na: number;
  pending: number;
};

export function countResults(points: { result: FatsatResult }[]): ResultCount {
  const c: ResultCount = { total: points.length, pass: 0, fail: 0, na: 0, pending: 0 };
  for (const p of points) c[p.result] += 1;
  return c;
}

/** Estado global sugerido a partir de los puntos (es solo una pista, editable). */
export function suggestStatus(points: { result: FatsatResult }[]): FatsatStatus {
  if (points.length === 0) return "draft";
  const c = countResults(points);
  if (c.pending > 0) return "in_progress";
  if (c.fail > 0) return "rejected";
  return "approved";
}

export type TemplatePoint = {
  section: string;
  description: string;
  expected_result: string;
};

/** Plantillas básicas de checklist precargadas al crear un protocolo. */
export const TEMPLATES: Record<FatsatType, TemplatePoint[]> = {
  fat: [
    {
      section: "Inspección visual",
      description: "Verificar etiquetado, rotulado y cableado según planos",
      expected_result: "Conforme a planos, sin daños",
    },
    {
      section: "Energización",
      description: "Aplicar tensión de alimentación y de control",
      expected_result: "Encendido sin fallas ni alarmas",
    },
    {
      section: "Señales digitales",
      description: "Probar todas las entradas y salidas digitales",
      expected_result: "Todas las E/S responden correctamente",
    },
    {
      section: "Señales analógicas",
      description: "Verificar lazos analógicos 4-20 mA / 0-10 V",
      expected_result: "Lecturas dentro de rango y calibradas",
    },
    {
      section: "Lógica de control",
      description: "Validar secuencias y enclavamientos",
      expected_result: "Operación según narrativa de control",
    },
    {
      section: "Alarmas",
      description: "Forzar condiciones de alarma",
      expected_result: "Alarmas se activan, registran y notifican",
    },
    {
      section: "Comunicaciones",
      description: "Probar protocolos (Modbus / Profibus / Ethernet)",
      expected_result: "Comunicación estable sin pérdidas",
    },
    {
      section: "Seguridad",
      description: "Accionar paro de emergencia y enclavamientos de seguridad",
      expected_result: "Corte inmediato y seguro de salidas",
    },
  ],
  sat: [
    {
      section: "Instalación",
      description: "Verificar montaje físico, anclajes y conexionado en sitio",
      expected_result: "Instalación conforme a planos as-built",
    },
    {
      section: "Energización en sitio",
      description: "Energizar el sistema en condiciones reales",
      expected_result: "Arranque sin fallas",
    },
    {
      section: "Integración",
      description: "Validar integración con equipos de campo e instrumentos",
      expected_result: "Señales de campo correctas en HMI/SCADA",
    },
    {
      section: "Comunicaciones",
      description: "Probar enlace con PLC, SCADA y red del cliente",
      expected_result: "Comunicación estable extremo a extremo",
    },
    {
      section: "Pruebas funcionales",
      description: "Ejecutar pruebas funcionales del proceso en sitio",
      expected_result: "Funcionamiento según especificación",
    },
    {
      section: "Históricos y reportes",
      description: "Verificar registro de tendencias y reportes",
      expected_result: "Datos almacenados y reportes correctos",
    },
    {
      section: "Capacitación",
      description: "Capacitación a operadores y entrega de manuales",
      expected_result: "Personal capacitado y documentación entregada",
    },
  ],
};
