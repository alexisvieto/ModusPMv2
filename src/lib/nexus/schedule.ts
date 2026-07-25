// Programación del cronograma (Gantt) — MISMA lógica para la app y el Excel.
// Días hábiles, secuencial; una categoría "paralelo" arranca junto a la anterior.

export type SchedInput = {
  name: string;
  color?: string | null;
  duracion: number;
  paralelo: boolean;
  labor?: { profile_name: string }[];
};

export type SchedRow = {
  name: string;
  color: string | null;
  dur: number;
  start: number; // día 1-based
  end: number;
  paralelo: boolean;
  recurso: string;
};

export function scheduleGantt(cats: SchedInput[]): {
  rows: SchedRow[];
  totalDays: number;
} {
  const rows: SchedRow[] = [];
  let cursor = 1;
  let prevStart = 1;
  let maxEnd = 0;

  cats.forEach((c, i) => {
    const dur = Math.max(0, Math.round(c.duracion || 0));
    const start = c.paralelo && i > 0 ? prevStart : cursor;
    const end = dur > 0 ? start + dur - 1 : start - 1;
    prevStart = start;
    if (dur > 0) {
      cursor = Math.max(cursor, end + 1);
      maxEnd = Math.max(maxEnd, end);
    }
    const recurso =
      [...new Set((c.labor ?? []).map((l) => l.profile_name))].join(", ") || "—";
    rows.push({
      name: c.name,
      color: c.color ?? null,
      dur,
      start,
      end,
      paralelo: !!c.paralelo && i > 0,
      recurso,
    });
  });

  return { rows, totalDays: maxEnd };
}
