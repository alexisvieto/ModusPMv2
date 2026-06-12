"use client";

import {
  Document,
  Line,
  Page,
  Polyline,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  formatCompactCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { type Brand } from "@/lib/brand";
import { DOC, PdfFooter, PdfHeader } from "@/components/pdf/pdf-chrome";

export type DashboardPdfData = {
  brand: Brand;
  project: {
    name: string;
    code: string | null;
    client_name: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
  };
  health: string;
  generatedAt: string;
  kpis: {
    actualPct: number;
    plannedPct: number;
    scheduleGap: number;
    spi: number | null;
    cpi: number | null;
    actualCost: number;
    budget: number;
    costPct: number;
    currency: string;
  };
  curve: { date: string; plan: number; real: number | null }[];
  phases: { wbs: string | null; name: string; progress: number }[];
  lastReport: {
    report_date: string;
    summary: string | null;
    ai_summary: string | null;
    workforce: number;
    hours: number;
  } | null;
};

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: DOC.text, fontFamily: "Helvetica" },
  projectName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: DOC.navy, marginBottom: 2 },
  muted: { color: DOC.muted },
  metaLine: { color: DOC.muted, marginBottom: 1 },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 6 },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: DOC.border, borderRadius: 4, padding: 8 },
  kpiLabel: { color: DOC.muted, fontSize: 8, marginBottom: 3 },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: DOC.navy },
  kpiHint: { color: DOC.muted, fontSize: 7, marginTop: 2 },
  section: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DOC.navy, marginTop: 14, marginBottom: 6 },
  legendRow: { flexDirection: "row", gap: 14, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  chartWrap: { position: "relative", height: 196 },
  yLabel: { position: "absolute", left: 0, fontSize: 7, color: DOC.muted },
  xLabel: { position: "absolute", bottom: 0, fontSize: 7, color: DOC.muted },
  phaseItem: { marginBottom: 7 },
  phaseTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  phaseName: { flexDirection: "row", gap: 5, flex: 1 },
  wbs: { fontFamily: "Helvetica-Bold", color: DOC.muted, fontSize: 9 },
  bar: { height: 3, backgroundColor: DOC.light, borderRadius: 2 },
  barFill: { height: 3, backgroundColor: DOC.navy, borderRadius: 2 },
  aiBox: { borderWidth: 1, borderColor: DOC.orange, borderRadius: 4, padding: 10, marginTop: 8 },
  aiLabel: { color: DOC.orange, fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  statCard: { flex: 1, borderWidth: 1, borderColor: DOC.border, borderRadius: 4, padding: 7 },
});

function SCurve({ curve }: { curve: DashboardPdfData["curve"] }) {
  const W = 464;
  const H = 170;
  const n = curve.length;
  const X = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const Y = (v: number) => H - (Math.max(0, Math.min(100, v)) / 100) * H;
  const planPts = curve
    .map((d, i) => `${X(i).toFixed(1)},${Y(d.plan).toFixed(1)}`)
    .join(" ");
  const realPts = curve
    .map((d, i) => (d.real == null ? null : `${X(i).toFixed(1)},${Y(d.real).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const grid = [0, 25, 50, 75, 100];
  return (
    <View style={s.chartWrap}>
      <Text style={[s.yLabel, { top: 4 }]}>100%</Text>
      <Text style={[s.yLabel, { top: 86 }]}>50%</Text>
      <Text style={[s.yLabel, { top: 168 }]}>0%</Text>
      <View style={{ position: "absolute", left: 24, right: 6, top: 6 }}>
        <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 174 }}>
          <Rect x={0} y={0} width={W} height={H} fill={DOC.light} />
          {grid.map((g) => (
            <Line key={g} x1={0} y1={Y(g)} x2={W} y2={Y(g)} stroke="#E2E5EA" strokeWidth={1} />
          ))}
          {n > 1 && <Polyline points={planPts} fill="none" stroke={DOC.navy} strokeWidth={2} />}
          {n > 1 && realPts !== "" && (
            <Polyline points={realPts} fill="none" stroke={DOC.orange} strokeWidth={2.5} />
          )}
        </Svg>
      </View>
      <Text style={[s.xLabel, { left: 26 }]}>{curve[0] ? formatDate(curve[0].date) : ""}</Text>
      <Text style={[s.xLabel, { right: 6 }]}>{n ? formatDate(curve[n - 1].date) : ""}</Text>
    </View>
  );
}

export function DashboardPdfDocument({ data }: { data: DashboardPdfData }) {
  const { brand, project, kpis, curve, phases, lastReport } = data;
  const fmtCur = (v: number) => formatCompactCurrency(v, kpis.currency);
  return (
    <Document title={`Resumen ejecutivo — ${project.name}`} author={brand.name}>
      <Page size="A4" style={s.page}>
        <PdfHeader brand={brand} title="Resumen ejecutivo" meta={[`Generado ${data.generatedAt}`]} />

        <Text style={s.projectName}>{project.name}</Text>
        <Text style={s.metaLine}>
          {[project.code, project.status, data.health].filter(Boolean).join("  ·  ")}
        </Text>
        <Text style={s.muted}>
          {[
            project.client_name ? `Cliente: ${project.client_name}` : null,
            project.location,
            `${formatDate(project.start_date)} – ${formatDate(project.end_date)}`,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>

        {/* KPIs */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Avance real</Text>
            <Text style={s.kpiValue}>{formatPercent(kpis.actualPct, 1)}</Text>
            <Text style={s.kpiHint}>
              Plan {formatPercent(kpis.plannedPct, 1)} · {kpis.scheduleGap >= 0 ? "+" : ""}
              {formatNumber(kpis.scheduleGap, 1)} pts
            </Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>SPI · Cronograma</Text>
            <Text style={s.kpiValue}>{kpis.spi == null ? "—" : kpis.spi.toFixed(2)}</Text>
            <Text style={s.kpiHint}>
              {kpis.spi == null ? "Sin datos" : kpis.spi >= 1 ? "Adelantado" : "Detrás del plan"}
            </Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>CPI · Costo</Text>
            <Text style={s.kpiValue}>{kpis.cpi == null ? "—" : kpis.cpi.toFixed(2)}</Text>
            <Text style={s.kpiHint}>
              {kpis.cpi == null
                ? "Sin datos"
                : kpis.cpi >= 1
                  ? "Bajo presupuesto"
                  : "Sobre presupuesto"}
            </Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Costo real</Text>
            <Text style={s.kpiValue}>{fmtCur(kpis.actualCost)}</Text>
            <Text style={s.kpiHint}>
              de {fmtCur(kpis.budget)} · {formatPercent(kpis.costPct, 0)}
            </Text>
          </View>
        </View>

        {/* Curva S */}
        <Text style={s.section}>Curva S — avance planificado vs real</Text>
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: DOC.navy }]} />
            <Text style={s.muted}>Plan</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: DOC.orange }]} />
            <Text style={s.muted}>Real</Text>
          </View>
        </View>
        <SCurve curve={curve} />

        {/* Avance por fase */}
        {phases.length > 0 ? (
          <>
            <Text style={s.section}>Avance por fase</Text>
            {phases.map((p, i) => (
              <View key={i} style={s.phaseItem} wrap={false}>
                <View style={s.phaseTop}>
                  <View style={s.phaseName}>
                    {p.wbs ? <Text style={s.wbs}>{p.wbs}</Text> : null}
                    <Text>{p.name}</Text>
                  </View>
                  <Text style={s.muted}>{formatNumber(p.progress, 0)}%</Text>
                </View>
                <View style={s.bar}>
                  <View
                    style={[s.barFill, { width: `${Math.max(0, Math.min(100, p.progress))}%` }]}
                  />
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Último reporte */}
        {lastReport ? (
          <View wrap={false}>
            <Text style={s.section}>Último reporte diario</Text>
            <Text style={s.muted}>
              {formatDate(lastReport.report_date, {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </Text>
            {lastReport.summary ? (
              <Text style={{ marginTop: 4, lineHeight: 1.5 }}>{lastReport.summary}</Text>
            ) : null}
            {lastReport.ai_summary ? (
              <View style={s.aiBox}>
                <Text style={s.aiLabel}>RESUMEN IA</Text>
                <Text style={{ lineHeight: 1.5 }}>{lastReport.ai_summary}</Text>
              </View>
            ) : null}
            <View style={s.statRow}>
              <View style={s.statCard}>
                <Text style={s.kpiLabel}>Personal</Text>
                <Text style={s.kpiValue}>{formatNumber(lastReport.workforce, 0)}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.kpiLabel}>Horas-hombre</Text>
                <Text style={s.kpiValue}>{formatNumber(lastReport.hours, 0)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <PdfFooter brand={brand} />
      </Page>
    </Document>
  );
}
