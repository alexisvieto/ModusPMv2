import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Mic } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

type Periodo = "mes" | "anio" | "todo";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const TIPO_COLOR: Record<string, string> = {
  accidente: "#DC2626",
  incidente: "#E8A020",
  cuasi_accidente: "#15803D",
};
const TIPO_LABEL: Record<string, string> = {
  accidente: "Accidentes",
  incidente: "Incidentes",
  cuasi_accidente: "Cuasi-accidentes",
};
const SEV_COLOR: Record<string, string> = {
  leve: "#15803D",
  moderado: "#CA8A04",
  grave: "#E8A020",
  fatal: "#DC2626",
};
const SEV_LABEL: Record<string, string> = {
  leve: "Leve",
  moderado: "Moderado",
  grave: "Grave",
  fatal: "Fatal",
};

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const sp = await searchParams;
  const periodo: Periodo = sp.periodo === "mes" || sp.periodo === "todo" ? sp.periodo : "anio";

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;
  if (!orgId) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm text-muted-foreground">Sin organización.</div>
    );
  }

  const now = new Date();
  const year = now.getFullYear();
  const today = now.toISOString().split("T")[0];
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(now.getMonth() + 1)}-01`;
  const yearStart = `${year}-01-01`;
  const desde = periodo === "mes" ? monthStart : periodo === "anio" ? yearStart : "0001-01-01";

  const [{ data: incAll }, { data: insAll }, { data: charlasAll }] = await Promise.all([
    supabase
      .from("hse_incidentes")
      .select("tipo_evento, severidad, fecha_evento, dias_perdidos, estado, requirio_atencion_medica")
      .eq("organization_id", orgId),
    supabase
      .from("hse_inspecciones")
      .select("riesgo, estado, fecha, fecha_limite")
      .eq("organization_id", orgId),
    supabase.from("hse_charlas").select("id, fecha").eq("organization_id", orgId),
  ]);

  // Asistencias del período (por charla dentro del período).
  const charlasPeriodo = (charlasAll ?? []).filter((c) => c.fecha >= desde);
  const charlaIdsPeriodo = charlasPeriodo.map((c) => c.id);
  let asistenciasCount = 0;
  if (charlaIdsPeriodo.length) {
    const { count } = await supabase
      .from("hse_charla_asistencias")
      .select("*", { count: "exact", head: true })
      .in("charla_id", charlaIdsPeriodo);
    asistenciasCount = count ?? 0;
  }

  const inc = (incAll ?? []).filter((i) => i.fecha_evento >= desde);
  const ins = (insAll ?? []).filter((i) => i.fecha >= desde);

  // ── Incidentes: tipo, severidad, días perdidos ──
  const porTipo = { accidente: 0, incidente: 0, cuasi_accidente: 0 } as Record<string, number>;
  const porSev = { leve: 0, moderado: 0, grave: 0, fatal: 0 } as Record<string, number>;
  let diasPerdidos = 0;
  let atencionMedica = 0;
  for (const i of inc) {
    porTipo[i.tipo_evento] = (porTipo[i.tipo_evento] ?? 0) + 1;
    porSev[i.severidad] = (porSev[i.severidad] ?? 0) + 1;
    diasPerdidos += i.dias_perdidos ?? 0;
    if (i.requirio_atencion_medica) atencionMedica += 1;
  }

  // ── Tendencia: últimos 6 meses (independiente del filtro) ──
  const meses: { key: string; label: string; count: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(year, now.getMonth() - k, 1);
    meses.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: MESES[d.getMonth()],
      count: 0,
    });
  }
  for (const i of incAll ?? []) {
    const key = (i.fecha_evento ?? "").slice(0, 7);
    const m = meses.find((x) => x.key === key);
    if (m) m.count += 1;
  }

  // ── Cumplimiento de hallazgos ──
  const hTotal = ins.length;
  const hCerrados = ins.filter((i) => i.estado === "cerrado").length;
  const hAbiertos = hTotal - hCerrados;
  const hVencidos = ins.filter(
    (i) => i.estado !== "cerrado" && i.fecha_limite && i.fecha_limite < today,
  ).length;
  const pctCierre = hTotal > 0 ? Math.round((hCerrados / hTotal) * 100) : 0;

  const incTotal = inc.length;

  const periodoLabel =
    periodo === "mes" ? "Este mes" : periodo === "anio" ? `Año ${year}` : "Histórico";

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Indicadores HSE</h1>
          <p className="text-sm text-muted-foreground">
            Tendencias y cumplimiento · {periodoLabel}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["mes", "Mes"],
              ["anio", "Año"],
              ["todo", "Histórico"],
            ] as const
          ).map(([val, lbl]) => (
            <Link
              key={val}
              href={`/app/hse/indicadores?periodo=${val}`}
              className={
                "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                (periodo === val
                  ? "bg-[#0f2044] text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground")
              }
            >
              {lbl}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={<AlertTriangle className="size-5 text-[#0f2044]" />} value={incTotal} label="Incidentes" />
        <Kpi icon={<CalendarDays className="size-5 text-[#0f2044]" />} value={diasPerdidos} label="Días perdidos" />
        <Kpi icon={<Mic className="size-5 text-[#0f2044]" />} value={charlasPeriodo.length} label="Charlas" sub={`${asistenciasCount} firmas`} />
        <Kpi icon={<CheckCircle2 className="size-5 text-[#0f2044]" />} value={`${pctCierre}%`} label="Cierre hallazgos" sub={`${hAbiertos} abiertos`} />
      </div>

      {/* Tendencia mensual */}
      <Card title="Tendencia de incidentes (6 meses)">
        <MonthlyBars data={meses} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pirámide de seguridad */}
        <Card title="Pirámide de seguridad">
          {incTotal === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {(["accidente", "incidente", "cuasi_accidente"] as const).map((t) => (
                <PyramidRow
                  key={t}
                  label={TIPO_LABEL[t]}
                  value={porTipo[t]}
                  max={Math.max(1, ...Object.values(porTipo))}
                  color={TIPO_COLOR[t]}
                />
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Base ancha (cuasi-accidentes) = cultura de reporte sana.
              </p>
            </div>
          )}
        </Card>

        {/* Distribución por severidad */}
        <Card title="Incidentes por severidad">
          {incTotal === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {(["leve", "moderado", "grave", "fatal"] as const).map((s) => (
                <HBar
                  key={s}
                  label={SEV_LABEL[s]}
                  value={porSev[s]}
                  max={Math.max(1, ...Object.values(porSev))}
                  color={SEV_COLOR[s]}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Cumplimiento de hallazgos */}
      <Card title="Cumplimiento de inspecciones (hallazgos)">
        {hTotal === 0 ? (
          <Empty />
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <Ring pct={pctCierre} />
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Stat label="Total" value={hTotal} />
              <Stat label="Cerrados" value={hCerrados} color="#15803D" />
              <Stat label="Abiertos" value={hAbiertos} color="#CA8A04" />
              <Stat label="Vencidos" value={hVencidos} color="#DC2626" />
            </div>
          </div>
        )}
      </Card>

      {atencionMedica > 0 && (
        <p className="text-xs text-muted-foreground">
          {atencionMedica} incidente{atencionMedica !== 1 ? "s" : ""} requirió atención médica en el
          período.
        </p>
      )}
    </div>
  );
}

function Kpi({
  icon,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      {icon}
      <p className="mt-2 text-2xl font-bold tabular-nums text-[#0f2044]">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="py-4 text-sm text-muted-foreground">Sin datos en el período.</p>;
}

function MonthlyBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-2" style={{ height: 120 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium tabular-nums text-[#0f2044]">{d.count || ""}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-[#0f2044]"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 0 }}
            />
          </div>
          <span className="text-xs capitalize text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function PyramidRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-1 justify-center">
        <div
          className="h-6 rounded"
          style={{
            width: `${Math.max(6, (value / max) * 100)}%`,
            backgroundColor: color,
            minWidth: value ? undefined : 6,
          }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function HBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
        <div className="h-full rounded" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="shrink-0">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#E5E7EB" strokeWidth="9" />
      <circle
        cx="45"
        cy="45"
        r={r}
        fill="none"
        stroke="#0f2044"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 45 45)"
      />
      <text x="45" y="50" textAnchor="middle" className="fill-[#0f2044] text-lg font-bold">
        {pct}%
      </text>
    </svg>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <span className="text-lg font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="ml-1.5 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
