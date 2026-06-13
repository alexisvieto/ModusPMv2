"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";
import { type Brand } from "@/lib/brand";
import {
  docPalette,
  type DocPalette,
  PdfFooter,
  PdfHeader,
} from "@/components/pdf/pdf-chrome";

export type FatsatPdfItem = {
  description: string;
  result: string;
  notes: string | null;
};

export type FatsatPdfData = {
  brand: Brand;
  project: { name: string; code: string | null; client_name: string | null };
  prueba: {
    name: string | null;
    protocol_date: string;
    status: string;
    notes: string | null;
    executed_by_name: string | null;
    executed_by_role: string | null;
    executed_at: string | null;
    witness_by_name: string | null;
    witness_by_role: string | null;
    witness_at: string | null;
    approved_by_name: string | null;
    approved_by_role: string | null;
    approved_at: string | null;
  };
  items: FatsatPdfItem[];
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  in_progress: "En ejecución",
  approved: "Aprobada",
  approved_with_observations: "Aprobada con observaciones",
  rejected: "Con fallos",
};
const RESULT_LABEL: Record<string, string> = {
  pending: "Pendiente",
  pass: "Aprobado",
  fail: "Fallido",
  na: "N/A",
};
const RESULT_COLOR: Record<string, string> = {
  pending: "#B45309",
  pass: "#15803D",
  fail: "#B91C1C",
  na: "#6B7280",
};

const fmtDate = (d: string | null) =>
  d ? formatDate(d, { day: "2-digit", month: "long", year: "numeric" }) : "—";

const makeStyles = (P: DocPalette) =>
  StyleSheet.create({
    page: { padding: 32, fontSize: 9, color: P.text, fontFamily: "Helvetica" },
    pruebaName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: P.navy, marginBottom: 2 },
    muted: { color: P.muted },
    metaRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
    metaCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: P.border,
      borderRadius: 4,
      padding: 7,
    },
    metaLabel: { color: P.muted, fontSize: 7, marginBottom: 2 },
    metaValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: P.navy },
    section: { fontSize: 10, fontFamily: "Helvetica-Bold", color: P.navy, marginBottom: 4, marginTop: 6 },
    thead: {
      flexDirection: "row",
      backgroundColor: P.light,
      paddingVertical: 4,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: P.border,
    },
    th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: P.muted },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: P.border,
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    cNum: { width: 16 },
    cDesc: { flex: 1 },
    cRes: { width: 60, textAlign: "right" },
    noteLine: { fontSize: 7, color: P.muted, marginTop: 1 },
    signRow: { flexDirection: "row", gap: 12, marginTop: 28 },
    signCell: { flex: 1 },
    signLine: { borderTopWidth: 1, borderTopColor: P.text, paddingTop: 4 },
    signRole: { fontSize: 9, color: P.muted, fontFamily: "Helvetica-Bold" },
    signName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },
  });

type Styles = ReturnType<typeof makeStyles>;

function Sign({
  role,
  name,
  jobRole,
  date,
  s,
}: {
  role: string;
  name: string | null;
  jobRole: string | null;
  date: string | null;
  s: Styles;
}) {
  return (
    <View style={s.signCell}>
      <View style={s.signLine}>
        <Text style={s.signRole}>{role}</Text>
        <Text style={s.signName}>{name || "—"}</Text>
        {jobRole ? <Text style={s.muted}>{jobRole}</Text> : null}
        <Text style={s.muted}>{date ? fmtDate(date) : ""}</Text>
      </View>
    </View>
  );
}

export function FatsatPdfDocument({ data }: { data: FatsatPdfData }) {
  const { brand, project, prueba, items } = data;
  const s = makeStyles(docPalette(brand));
  return (
    <Document title={`Prueba en campo ${prueba.name ?? ""}`} author={brand.name}>
      <Page size="A4" style={s.page}>
        <PdfHeader
          brand={brand}
          title="Acta de pruebas en campo"
          meta={[`Estado: ${STATUS_LABEL[prueba.status] ?? prueba.status}`]}
        />

        <Text style={s.pruebaName}>{prueba.name ?? "Prueba en campo"}</Text>
        <Text style={s.muted}>
          {project.name}
          {project.code ? `  ·  ${project.code}` : ""}
          {project.client_name ? `  ·  ${project.client_name}` : ""}
        </Text>

        <View style={s.metaRow}>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>FECHA DE LAS PRUEBAS</Text>
            <Text style={s.metaValue}>{fmtDate(prueba.protocol_date)}</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>PRUEBAS</Text>
            <Text style={s.metaValue}>{items.length}</Text>
          </View>
        </View>

        <Text style={s.section}>Pruebas relacionadas</Text>
        <View style={s.thead}>
          <Text style={[s.th, s.cNum]}>#</Text>
          <Text style={[s.th, s.cDesc]}>Prueba</Text>
          <Text style={[s.th, s.cRes]}>Resultado</Text>
        </View>
        {items.length > 0 ? (
          items.map((it, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.cNum}>{i + 1}</Text>
              <View style={s.cDesc}>
                <Text>{it.description}</Text>
                {it.notes ? <Text style={s.noteLine}>Obs.: {it.notes}</Text> : null}
              </View>
              <Text style={[s.cRes, { color: RESULT_COLOR[it.result] ?? "#6B7280" }]}>
                {RESULT_LABEL[it.result] ?? it.result}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[s.muted, { paddingVertical: 6 }]}>Sin pruebas.</Text>
        )}

        {prueba.notes ? (
          <>
            <Text style={s.section}>Observaciones generales</Text>
            <Text style={{ lineHeight: 1.5 }}>{prueba.notes}</Text>
          </>
        ) : null}

        <View style={s.signRow}>
          <Sign role="EJECUTÓ" name={prueba.executed_by_name} jobRole={prueba.executed_by_role} date={prueba.executed_at} s={s} />
          <Sign role="TESTIGO" name={prueba.witness_by_name} jobRole={prueba.witness_by_role} date={prueba.witness_at} s={s} />
          <Sign role="APROBÓ" name={prueba.approved_by_name} jobRole={prueba.approved_by_role} date={prueba.approved_at} s={s} />
        </View>

        <PdfFooter brand={brand} />
      </Page>
    </Document>
  );
}
