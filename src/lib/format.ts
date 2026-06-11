// =========================================================
// Modus PM — Formato determinista (es-PA), SIN Intl.
// Intl varía entre Node (servidor) y el navegador (cliente)
// y provoca errores de hidratación; aquí lo evitamos por completo.
// =========================================================

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const MESES_ABBR = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function parse(date: string | Date): Date {
  if (typeof date !== "string") return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
    );
  }
  return new Date(date);
}

/** Agrupa miles con coma de forma determinista (sin Intl). */
function group(value: number, digits = 0): string {
  const n = Number.isFinite(value) ? value : 0;
  const fixed = Math.abs(n).toFixed(digits);
  const [intPart, dec] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${grouped}${dec ? `.${dec}` : ""}`;
}

export function formatDate(
  date: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return "—";
  const d = parse(date);
  const o = opts ?? { day: "2-digit", month: "short", year: "numeric" };
  const day =
    o.day === "numeric"
      ? String(d.getDate())
      : String(d.getDate()).padStart(2, "0");
  const yearStr =
    o.year === "2-digit"
      ? String(d.getFullYear()).slice(-2)
      : String(d.getFullYear());

  let core: string;
  if (o.month === "long") {
    core = `${day} de ${MESES[d.getMonth()]}${o.year ? ` de ${yearStr}` : ""}`;
  } else {
    core = `${day} ${MESES_ABBR[d.getMonth()]}${o.year ? ` ${yearStr}` : ""}`;
  }
  return o.weekday ? `${DIAS[d.getDay()]}, ${core}` : core;
}

/** "jun 26" — para ejes de gráficas / Gantt. */
export function monthYearShort(d: Date): string {
  return `${MESES_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

/** "11 jun" */
export function dayMonthShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_ABBR[d.getMonth()]}`;
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  return group(value ?? 0, digits);
}

export function formatCurrency(
  value: number | null | undefined,
  _currency = "USD",
  opts?: Intl.NumberFormatOptions,
) {
  const n = value ?? 0;
  return `${n < 0 ? "-" : ""}$${group(Math.abs(n), opts?.maximumFractionDigits ?? 0)}`;
}

/** Moneda compacta: $4.9M, $850K, $336. */
export function formatCompactCurrency(
  value: number | null | undefined,
  _currency = "USD",
) {
  const n = value ?? 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}$${group(abs, 0)}`;
}

/** Recibe un valor 0–100 y lo muestra como porcentaje. */
export function formatPercent(value: number | null | undefined, digits = 0) {
  return `${(value ?? 0).toFixed(digits)}%`;
}
