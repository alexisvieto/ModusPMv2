"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";

type Entry = { description: string; quantity: number | null; unit: string | null };

export type ReportPdfData = {
  project: { name: string; code: string | null; client_name: string | null };
  report: {
    report_date: string;
    weather: string | null;
    workforce: number;
    hours: number;
    summary: string | null;
    progress_note: string | null;
    ai_summary: string | null;
    status: string;
  };
  entries: Entry[];
  author: string | null;
};

const PETROL = "#0F766E";
const SLATE = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

const STATUS: Record<string, string> = {
  draft: "Borrador",
  submitted: "Enviado",
  approved: "Aprobado",
};

// Reusa el formateador determinista del sistema (sin Intl).
const fmtDate = (d: string) =>
  formatDate(d, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: SLATE, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: PETROL,
    paddingBottom: 12,
    marginBottom: 16,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  mark: {
    width: 22,
    height: 22,
    backgroundColor: PETROL,
    borderRadius: 4,
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 4,
  },
  brandName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  projectBox: { marginBottom: 14 },
  projectName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
  },
  metaLabel: { color: MUTED, fontSize: 8, marginBottom: 2 },
  metaValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  section: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 6,
  },
  paragraph: { lineHeight: 1.5, marginBottom: 10 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 5,
  },
  cellDesc: { flex: 1 },
  cellQty: { width: 90, textAlign: "right", color: MUTED },
  aiBox: {
    borderWidth: 1,
    borderColor: "#99E0D8",
    backgroundColor: "#F0FBFA",
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  aiLabel: {
    color: PETROL,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    color: MUTED,
    fontSize: 8,
  },
});

export function ReportPdfDocument({ data }: { data: ReportPdfData }) {
  const { project, report, entries, author } = data;
  return (
    <Document
      title={`Reporte diario ${report.report_date}`}
      author="Modus PM"
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>
            <Text style={s.mark}>M</Text>
            <Text style={s.brandName}>Modus PM</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Reporte diario</Text>
            <Text style={s.muted}>{fmtDate(report.report_date)}</Text>
            <Text style={s.muted}>
              Estado: {STATUS[report.status] ?? report.status}
            </Text>
          </View>
        </View>

        <View style={s.projectBox}>
          <Text style={s.projectName}>{project.name}</Text>
          <Text style={s.muted}>
            {project.code ? `${project.code}  ·  ` : ""}
            {project.client_name ? `Cliente: ${project.client_name}` : ""}
          </Text>
        </View>

        <View style={s.metaRow}>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>Personal</Text>
            <Text style={s.metaValue}>{report.workforce}</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>Horas-hombre</Text>
            <Text style={s.metaValue}>{report.hours}</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>Clima</Text>
            <Text style={s.metaValue}>{report.weather ?? "—"}</Text>
          </View>
        </View>

        {report.summary ? (
          <>
            <Text style={s.section}>Resumen del día</Text>
            <Text style={s.paragraph}>{report.summary}</Text>
          </>
        ) : null}

        <Text style={s.section}>Actividades</Text>
        {entries.length > 0 ? (
          entries.map((e, i) => (
            <View key={i} style={s.row}>
              <Text style={s.cellDesc}>{e.description}</Text>
              <Text style={s.cellQty}>
                {e.quantity ? `${e.quantity} ${e.unit ?? ""}` : ""}
              </Text>
            </View>
          ))
        ) : (
          <Text style={s.muted}>Sin actividades registradas.</Text>
        )}

        {report.progress_note ? (
          <>
            <Text style={s.section}>Nota de avance</Text>
            <Text style={s.paragraph}>{report.progress_note}</Text>
          </>
        ) : null}

        {report.ai_summary ? (
          <View style={s.aiBox}>
            <Text style={s.aiLabel}>RESUMEN IA</Text>
            <Text style={{ lineHeight: 1.5 }}>{report.ai_summary}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>
            {author ? `Elaborado por ${author}` : "Modus PM"}
          </Text>
          <Text>Generado con Modus PM</Text>
        </View>
      </Page>
    </Document>
  );
}
