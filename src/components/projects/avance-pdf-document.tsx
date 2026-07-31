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

import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { type Brand } from "@/lib/brand";
import {
  docPalette,
  type DocPalette,
  PdfFooter,
  PdfHeader,
} from "@/components/pdf/pdf-chrome";

export type AvancePdfData = {
  brand: Brand;
  project: {
    name: string;
    code: string | null;
    odoo_code: string | null;
    client_name: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
  };
  generatedAt: string;
  kpis: { actualPct: number; plannedPct: number; gap: number; spi: number | null };
  curve: { date: string; plan: number; real: number | null }[];
  tasks: { wbs: string | null; name: string; isPhase: boolean; planPct: number; realPct: number }[];
};

const makeStyles = (P: DocPalette) =>
  StyleSheet.create({
    page: { padding: 32, fontSize: 10, color: P.text, fontFamily: "Helvetica" },
    projectName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: P.navy, marginBottom: 2 },
    muted: { color: P.muted },
    metaLine: { color: P.muted, marginBottom: 1 },
    kpiRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 6 },
    kpiCard: { flex: 1, borderWidth: 1, borderColor: P.border, borderRadius: 4, padding: 8 },
    kpiLabel: { color: P.muted, fontSize: 8, marginBottom: 3 },
    kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: P.navy },
    kpiHint: { color: P.muted, fontSize: 7, marginTop: 2 },
    section: { fontSize: 11, fontFamily: "Helvetica-Bold", color: P.navy, marginTop: 14, marginBottom: 6 },
    legendRow: { flexDirection: "row", gap: 14, marginBottom: 4 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    chartWrap: { position: "relative", height: 196 },
    yLabel: { position: "absolute", left: 0, fontSize: 7, color: P.muted },
    xLabel: { position: "absolute", bottom: 0, fontSize: 7, color: P.muted },
    thead: { flexDirection: "row", backgroundColor: P.light, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 3 },
    trow: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: P.border },
    phaseRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, backgroundColor: P.light, marginTop: 3 },
    cWbs: { width: 46, color: P.muted, fontFamily: "Helvetica-Bold", fontSize: 8 },
    cName: { flex: 1 },
    cPct: { width: 52, textAlign: "right" },
    thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: P.muted },
  });

type Styles = ReturnType<typeof makeStyles>;

function SCurve({ curve, s, P }: { curve: AvancePdfData["curve"]; s: Styles; P: DocPalette }) {
  const W = 464;
  const H = 170;
  const n = curve.length;
  const X = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const Y = (v: number) => H - (Math.max(0, Math.min(100, v)) / 100) * H;
  const planPts = curve.map((d, i) => `${X(i).toFixed(1)},${Y(d.plan).toFixed(1)}`).join(" ");
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
          <Rect x={0} y={0} width={W} height={H} fill={P.light} />
          {grid.map((g) => (
            <Line key={g} x1={0} y1={Y(g)} x2={W} y2={Y(g)} stroke="#E2E5EA" strokeWidth={1} />
          ))}
          {n > 1 && <Polyline points={planPts} fill="none" stroke={P.navy} strokeWidth={2} />}
          {n > 1 && realPts !== "" && (
            <Polyline points={realPts} fill="none" stroke={P.orange} strokeWidth={2.5} />
          )}
        </Svg>
      </View>
      <Text style={[s.xLabel, { left: 26 }]}>{curve[0] ? formatDate(curve[0].date) : ""}</Text>
      <Text style={[s.xLabel, { right: 6 }]}>{n ? formatDate(curve[n - 1].date) : ""}</Text>
    </View>
  );
}

export function AvancePdfDocument({ data }: { data: AvancePdfData }) {
  const { brand, project, kpis, curve, tasks } = data;
  const P = docPalette(brand);
  const s = makeStyles(P);
  return (
    <Document title={`Control de Avance — ${project.name}`} author={brand.name}>
      <Page size="A4" style={s.page}>
        <PdfHeader
          brand={brand}
          title="Control de Avance de Obra"
          meta={[`PD-F-001`, `Avance al ${data.generatedAt}`]}
        />

        <Text style={s.projectName}>{project.name}</Text>
        <Text style={s.metaLine}>
          {[project.code, project.odoo_code ? `Odoo ${project.odoo_code}` : null]
            .filter(Boolean)
            .join("  ·  ")}
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

        {/* KPIs (avance físico, sin costos) */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Avance real</Text>
            <Text style={s.kpiValue}>{formatPercent(kpis.actualPct, 1)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Avance planificado</Text>
            <Text style={s.kpiValue}>{formatPercent(kpis.plannedPct, 1)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Desvío vs plan</Text>
            <Text style={s.kpiValue}>
              {kpis.gap >= 0 ? "+" : ""}
              {formatNumber(kpis.gap, 1)} pts
            </Text>
            <Text style={s.kpiHint}>{kpis.gap >= 0 ? "Adelantado" : "Detrás del plan"}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>SPI · Cronograma</Text>
            <Text style={s.kpiValue}>{kpis.spi == null ? "—" : kpis.spi.toFixed(2)}</Text>
          </View>
        </View>

        {/* Curva S */}
        <Text style={s.section}>Curva S — avance planificado vs real</Text>
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: P.navy }]} />
            <Text style={s.muted}>Plan</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: P.orange }]} />
            <Text style={s.muted}>Real</Text>
          </View>
        </View>
        <SCurve curve={curve} s={s} P={P} />

        {/* Detalle por tarea */}
        <Text style={s.section}>Detalle de avance por tarea</Text>
        <View style={s.thead}>
          <Text style={[s.cWbs, s.thText]}>WBS</Text>
          <Text style={[s.cName, s.thText]}>Concepto</Text>
          <Text style={[s.cPct, s.thText]}>Plan</Text>
          <Text style={[s.cPct, s.thText]}>Real</Text>
        </View>
        {tasks.map((t, i) => (
          <View key={i} style={t.isPhase ? s.phaseRow : s.trow} wrap={false}>
            <Text style={s.cWbs}>{t.wbs ?? ""}</Text>
            <Text
              style={[s.cName, t.isPhase ? { fontFamily: "Helvetica-Bold" } : {}]}
            >
              {t.name}
            </Text>
            <Text style={[s.cPct, s.muted]}>{formatNumber(t.planPct, 0)}%</Text>
            <Text style={[s.cPct, t.isPhase ? { fontFamily: "Helvetica-Bold" } : {}]}>
              {formatNumber(t.realPct, 0)}%
            </Text>
          </View>
        ))}

        <PdfFooter brand={brand} />
      </Page>
    </Document>
  );
}
