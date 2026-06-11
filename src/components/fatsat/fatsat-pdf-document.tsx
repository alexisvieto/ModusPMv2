"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";

export type FatsatPdfPoint = {
  section: string | null;
  description: string;
  expected_result: string | null;
  actual_result: string | null;
  result: string;
  notes: string | null;
};

export type FatsatPdfData = {
  project: { name: string; code: string | null; client_name: string | null };
  protocol: {
    type: string;
    code: string | null;
    equipment_name: string | null;
    tag: string | null;
    protocol_date: string;
    location: string | null;
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
  points: FatsatPdfPoint[];
};

const PETROL = "#0F766E";
const SLATE = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  in_progress: "En ejecución",
  approved: "Aprobado",
  approved_with_observations: "Aprobado con observaciones",
  rejected: "Rechazado",
};
const RESULT_LABEL: Record<string, string> = {
  pending: "Pendiente",
  pass: "Aprobado",
  fail: "Rechazado",
  na: "N/A",
};
const RESULT_COLOR: Record<string, string> = {
  pending: MUTED,
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
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  projectName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
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
  cDesc: { flex: 2 },
  cExp: { flex: 1.4 },
  cAct: { flex: 1.4 },
  cRes: { width: 50, textAlign: "right" },
  secLabel: { fontSize: 7, color: PETROL, fontFamily: "Helvetica-Bold" },
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
  const { project, protocol, points } = data;
  const isFat = protocol.type === "fat";
  const title = isFat ? "Protocolo FAT" : "Protocolo SAT";
  return (
    <Document title={`${title} ${protocol.code ?? ""}`} author="Modus PM">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>
            <Text style={s.mark}>M</Text>
            <Text style={s.brandName}>Modus PM</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>
              {title}
              {protocol.code ? ` · ${protocol.code}` : ""}
            </Text>
            <Text style={s.muted}>
              {isFat ? "Pruebas en fábrica" : "Pruebas en sitio"}
            </Text>
            <Text style={s.muted}>
              Estado: {STATUS_LABEL[protocol.status] ?? protocol.status}
            </Text>
          </View>
        </View>

        <Text style={s.projectName}>{project.name}</Text>
        <Text style={s.muted}>
          {project.code ? `${project.code}  ·  ` : ""}
          {project.client_name ? `Cliente: ${project.client_name}` : ""}
        </Text>

        <View style={s.metaRow}>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>EQUIPO / SISTEMA</Text>
            <Text style={s.metaValue}>{protocol.equipment_name ?? "—"}</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>TAG</Text>
            <Text style={s.metaValue}>{protocol.tag ?? "—"}</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>FECHA</Text>
            <Text style={s.metaValue}>{fmtDate(protocol.protocol_date)}</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>UBICACIÓN</Text>
            <Text style={s.metaValue}>{protocol.location ?? "—"}</Text>
          </View>
        </View>

        <Text style={s.section}>Puntos de prueba</Text>
        <View style={s.thead}>
          <Text style={[s.th, s.cNum]}>#</Text>
          <Text style={[s.th, s.cDesc]}>Criterio</Text>
          <Text style={[s.th, s.cExp]}>Esperado</Text>
          <Text style={[s.th, s.cAct]}>Real</Text>
          <Text style={[s.th, s.cRes]}>Resultado</Text>
        </View>
        {points.length > 0 ? (
          points.map((p, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.cNum}>{i + 1}</Text>
              <View style={s.cDesc}>
                {p.section ? <Text style={s.secLabel}>{p.section}</Text> : null}
                <Text>{p.description}</Text>
                {p.notes ? <Text style={s.noteLine}>Obs.: {p.notes}</Text> : null}
              </View>
              <Text style={s.cExp}>{p.expected_result ?? "—"}</Text>
              <Text style={s.cAct}>{p.actual_result ?? "—"}</Text>
              <Text style={[s.cRes, { color: RESULT_COLOR[p.result] ?? MUTED }]}>
                {RESULT_LABEL[p.result] ?? p.result}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[s.muted, { paddingVertical: 6 }]}>
            Sin puntos de prueba.
          </Text>
        )}

        {protocol.notes ? (
          <>
            <Text style={s.section}>Observaciones generales</Text>
            <Text style={{ lineHeight: 1.5 }}>{protocol.notes}</Text>
          </>
        ) : null}

        <View style={s.signRow}>
          <Sign
            role="EJECUTÓ"
            name={protocol.executed_by_name}
            jobRole={protocol.executed_by_role}
            date={protocol.executed_at}
          />
          <Sign
            role="TESTIGO"
            name={protocol.witness_by_name}
            jobRole={protocol.witness_by_role}
            date={protocol.witness_at}
          />
          <Sign
            role="APROBÓ"
            name={protocol.approved_by_name}
            jobRole={protocol.approved_by_role}
            date={protocol.approved_at}
          />
        </View>

        <View style={s.footer} fixed>
          <Text>{title}</Text>
          <Text>Generado con Modus PM</Text>
        </View>
      </Page>
    </Document>
  );
}
