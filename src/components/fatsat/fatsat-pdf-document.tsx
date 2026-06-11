"use client";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";
import { brandInitial, type Brand } from "@/lib/brand";

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

const PETROL = "#0F766E";
const SLATE = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

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
  na: MUTED,
};

const fmtDate = (d: string | null) =>
  d ? formatDate(d, { day: "2-digit", month: "long", year: "numeric" }) : "—";

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: SLATE, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: PETROL,
    paddingBottom: 12,
    marginBottom: 14,
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
  logo: { height: 26, width: 96, objectFit: "contain" },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  pruebaName: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  metaRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 7,
  },
  metaLabel: { color: MUTED, fontSize: 7, marginBottom: 2 },
  metaValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  section: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 6 },
  thead: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: MUTED },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  cNum: { width: 16 },
  cDesc: { flex: 1 },
  cRes: { width: 60, textAlign: "right" },
  noteLine: { fontSize: 7, color: MUTED, marginTop: 1 },
  signRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  signCell: { flex: 1 },
  signLine: { borderTopWidth: 1, borderTopColor: SLATE, paddingTop: 4 },
  signRole: { fontSize: 9, color: MUTED, fontFamily: "Helvetica-Bold" },
  signName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },
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

function Sign({
  role,
  name,
  jobRole,
  date,
}: {
  role: string;
  name: string | null;
  jobRole: string | null;
  date: string | null;
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
  return (
    <Document title={`Prueba en campo ${prueba.name ?? ""}`} author={brand.name}>
      <Page size="A4" style={s.page}>
        <View style={[s.header, { borderBottomColor: brand.primary }]}>
          {brand.logoUrl ? (
            <Image src={brand.logoUrl} style={s.logo} />
          ) : (
            <View style={s.brand}>
              <Text style={[s.mark, { backgroundColor: brand.primary }]}>
                {brandInitial(brand)}
              </Text>
              <Text style={s.brandName}>{brand.name}</Text>
            </View>
          )}
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Acta de pruebas en campo</Text>
            <Text style={s.muted}>
              Estado: {STATUS_LABEL[prueba.status] ?? prueba.status}
            </Text>
          </View>
        </View>

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
              <Text style={[s.cRes, { color: RESULT_COLOR[it.result] ?? MUTED }]}>
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
          <Sign
            role="EJECUTÓ"
            name={prueba.executed_by_name}
            jobRole={prueba.executed_by_role}
            date={prueba.executed_at}
          />
          <Sign
            role="TESTIGO"
            name={prueba.witness_by_name}
            jobRole={prueba.witness_by_role}
            date={prueba.witness_at}
          />
          <Sign
            role="APROBÓ"
            name={prueba.approved_by_name}
            jobRole={prueba.approved_by_role}
            date={prueba.approved_at}
          />
        </View>

        <View style={s.footer} fixed>
          <Text>
            {brand.name}
            {brand.website ? ` · ${brand.website}` : ""}
          </Text>
          <Text>Generado con Modus PM</Text>
        </View>
      </Page>
    </Document>
  );
}
