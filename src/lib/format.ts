const LOCALE = "es-PA";

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  opts?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...opts,
  }).format(value ?? 0);
}

/** Moneda compacta: $4.9M, $850K. Ideal para KPIs. */
export function formatCompactCurrency(
  value: number | null | undefined,
  currency = "USD",
) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

/** Recibe un valor 0–100 y lo muestra como porcentaje. */
export function formatPercent(value: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format((value ?? 0) / 100);
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value ?? 0);
}

export function formatDate(
  date: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
) {
  if (!date) return "—";
  const d =
    typeof date === "string"
      ? /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(
            Number(date.slice(0, 4)),
            Number(date.slice(5, 7)) - 1,
            Number(date.slice(8, 10)),
          )
        : new Date(date)
      : date;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(d);
}

export function cn2(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
