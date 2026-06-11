// =========================================================
// Modus PM — Calendario de días hábiles
// workdays: ISO weekday (1=Lun .. 7=Dom). Default Lun–Vie.
// exceptions: overrides por fecha (feriado=false, finde trabajado=true).
// =========================================================

export type CalendarException = { date: string; is_working: boolean };

export type WorkCalendar = {
  workdays: number[];
  exceptions: Map<string, boolean>;
};

function isoDow(d: Date): number {
  const g = d.getDay(); // 0=Dom .. 6=Sáb
  return g === 0 ? 7 : g;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function makeCalendar(
  workdays: number[] | null | undefined,
  exceptions: CalendarException[],
): WorkCalendar {
  const map = new Map<string, boolean>();
  for (const e of exceptions) map.set(e.date, e.is_working);
  return {
    workdays: workdays?.length ? workdays : [1, 2, 3, 4, 5],
    exceptions: map,
  };
}

export function isWorkingDay(date: Date | string, cal: WorkCalendar): boolean {
  const iso = typeof date === "string" ? date : toISODate(date);
  if (cal.exceptions.has(iso)) return cal.exceptions.get(iso)!;
  const d = typeof date === "string" ? parseISODate(date) : date;
  return cal.workdays.includes(isoDow(d));
}

/** Días hábiles inclusivos entre dos fechas ISO. */
export function workingDaysBetween(
  startISO: string | null,
  endISO: string | null,
  cal: WorkCalendar,
): number {
  if (!startISO || !endISO) return 0;
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (isWorkingDay(cur, cal)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Suma N días hábiles a una fecha inicio (el día inicio cuenta). Devuelve fecha fin ISO. */
export function addWorkingDays(
  startISO: string,
  durationDays: number,
  cal: WorkCalendar,
): string {
  if (!startISO || durationDays <= 0) return startISO;
  const cur = parseISODate(startISO);
  // Guardia anti-loop: si no hay días hábiles configurados, no colgamos el navegador.
  const MAX_ITER = durationDays * 7 + 800;
  let iter = 0;
  while (!isWorkingDay(cur, cal)) {
    cur.setDate(cur.getDate() + 1);
    if (++iter > MAX_ITER) return toISODate(cur);
  }
  let counted = 0;
  while (true) {
    if (isWorkingDay(cur, cal)) {
      counted++;
      if (counted >= durationDays) break;
    }
    cur.setDate(cur.getDate() + 1);
    if (++iter > MAX_ITER) break;
  }
  return toISODate(cur);
}

/** Días totales (calendario) inclusivos — para el ancho de las barras del Gantt. */
export function calendarDaysBetween(
  startISO: string | null,
  endISO: string | null,
): number {
  if (!startISO || !endISO) return 0;
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  return Math.max(0, Math.round((+end - +start) / 86400000)) + 1;
}
