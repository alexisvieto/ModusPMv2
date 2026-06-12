"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";
import { type Brand } from "@/lib/brand";
import { DOC, PdfFooter, PdfHeader } from "@/components/pdf/pdf-chrome";

type Entry = { description: string; quantity: number | null; unit: string | null };

export type ReportPdfData = {
  brand: Brand;
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
  page: { padding: 32, fontSize: 10, color: DOC.text, fontFamily: "Helvetica" },
  projectBox: { marginBottom: 14 },
  projectName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: DOC.navy, marginBottom: 2 },
  muted: { color: DOC.muted },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  metaCard: { flex: 1, borderWidth: 1, borderColor: DOC.border, borderRadius: 4, padding: 8 },
  metaLabel: { color: DOC.muted, fontSize: 8, marginBottom: 2 },
  metaValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DOC.navy },
  section: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DOC.navy,
    marginBottom: 6,
    marginTop: 6,
  },
  paragraph: { lineHeight: 1.5, marginBottom: 10 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: DOC.border,
    paddingVertical: 5,
  },
  cellDesc: { flex: 1 },
  cellQty: { width: 90, textAlign: "right", color: DOC.muted },
  aiBox: {
    borderWidth: 1,
    borderColor: DOC.orange,
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  aiLabel: {
    color: DOC.orange,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 3,
  },
});

export function ReportPdfDocument({ data }: { data: ReportPdfData }) {
  const { brand, project, report, entries, author } = data;
  return (
    <Document title={`Reporte diario ${report.report_date}`} author={brand.name}>
      <Page size="A4" style={s.page}>
        <PdfHeader
          brand={brand}
          title="Reporte diario"
          meta={[fmtDate(report.report_date), `Estado: ${STATUS[report.status] ?? report.status}`]}
        />

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

        <PdfFooter brand={brand} right={author ? `Elaborado por ${author}` : undefined} />
      </Page>
    </Document>
  );
}
