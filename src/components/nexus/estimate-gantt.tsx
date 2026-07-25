"use client";

import { scheduleGantt, type SchedInput } from "@/lib/nexus/schedule";

// Cronograma visual (Gantt) en pantalla, dentro de la cotización. Usa la MISMA
// programación que el Excel (schedule.ts): días hábiles, secuencial, y las
// categorías "paralelo" arrancan junto a la anterior. Es una vista derivada
// (los Días/Paralelo se editan arriba, en cada sistema).
const DAY = 22; // px por día

export function EstimateGantt({ cats }: { cats: SchedInput[] }) {
  const { rows, totalDays } = scheduleGantt(cats);

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b bg-[#0f2044] px-4 py-2 text-sm font-semibold text-white">
        <span>
          Cronograma{" "}
          <span className="font-normal text-white/60">· días hábiles</span>
        </span>
        {totalDays > 0 && (
          <span className="text-xs font-normal text-white/70">
            Duración total: {totalDays} {totalDays === 1 ? "día" : "días"}
          </span>
        )}
      </div>

      {totalDays === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Asigná <b>Días</b> a las categorías (arriba, en cada sistema) para ver
          el cronograma.
        </p>
      ) : (
        <div className="overflow-x-auto p-4">
          <div className="min-w-max">
            {/* escala de días */}
            <div className="flex items-center">
              <div className="w-48 shrink-0" />
              <div className="flex">
                {Array.from({ length: totalDays }, (_, d) => (
                  <div
                    key={d}
                    className="shrink-0 text-center text-[10px] text-muted-foreground"
                    style={{ width: DAY }}
                  >
                    {d + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* filas por sistema */}
            {rows.map((r, i) => (
              <div key={i} className="flex items-center py-0.5">
                <div className="flex w-48 shrink-0 items-center gap-2 pr-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: r.color ?? "#94a3b8" }}
                  />
                  <span className="truncate text-xs" title={r.name}>
                    {r.name}
                  </span>
                </div>
                <div
                  className="relative flex h-5"
                  style={{ width: totalDays * DAY }}
                >
                  {Array.from({ length: totalDays }, (_, d) => (
                    <div
                      key={d}
                      className="shrink-0 border-r border-muted first:border-l"
                      style={{ width: DAY }}
                    />
                  ))}
                  {r.dur > 0 && (
                    <div
                      className="absolute inset-y-0.5 flex items-center justify-center rounded-sm text-[10px] font-medium text-white"
                      style={{
                        left: (r.start - 1) * DAY,
                        width: r.dur * DAY,
                        backgroundColor: r.color ?? "#64748b",
                      }}
                      title={`${r.name}: ${r.dur} día(s), inicio día ${r.start}${
                        r.paralelo ? " (paralelo)" : ""
                      }`}
                    >
                      {r.dur >= 2 ? `${r.dur}d` : ""}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
