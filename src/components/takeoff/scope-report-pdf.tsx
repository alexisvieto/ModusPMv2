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
import {
  isRiskCategory,
  SCOPE_CATEGORY_LABEL,
  SYSTEM_LABEL,
} from "@/lib/takeoff/catalog";
import type { ScopeDocRow, ScopeItemRow } from "./scope-report";

export type ScopePdfData = {
  brand: Brand;
  taxId: string | null;
  reportFooter: string | null;
  doc: ScopeDocRow;
  items: ScopeItemRow[];
};

const SEV_COLOR: Record<string, string> = {
  alta: "#DC2626",
  media: "#D97706",
  baja: "#6B7280",
};

const makeStyles = (P: DocPalette) =>
  StyleSheet.create({
    page: { padding: 32, fontSize: 10, color: P.text, fontFamily: "Helvetica" },
    coverTitle: {
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      color: P.navy,
      marginTop: 10,
      marginBottom: 4,
    },
    muted: { color: P.muted },
    section: {
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      color: P.navy,
      marginTop: 14,
      marginBottom: 6,
    },
    paragraph: { lineHeight: 1.55, marginBottom: 8 },
    riskBox: {
      borderWidth: 1,
      borderColor: P.border,
      borderLeftWidth: 3,
      borderRadius: 3,
      padding: 7,
      marginBottom: 5,
    },
    riskHead: { flexDirection: "row", gap: 8, marginBottom: 2 },
    sevLabel: { fontFamily: "Helvetica-Bold", fontSize: 9 },
    quote: { color: P.muted, fontSize: 8.5, marginTop: 2 },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: P.border,
      paddingVertical: 4,
    },
    th: { fontFamily: "Helvetica-Bold", color: P.muted, fontSize: 8.5 },
    cDesc: { flex: 2 },
    cSmall: { flex: 1, color: P.muted },
    cQty: { width: 55, textAlign: "right" },
    bullet: { lineHeight: 1.5, marginBottom: 2 },
  });

export function ScopeReportPdfDocument({ data }: { data: ScopePdfData }) {
  const { brand, doc, items, taxId, reportFooter } = data;
  const s = makeStyles(docPalette(brand));

  const riesgos = items
    .filter((i) => isRiskCategory(i.category))
    .sort((a, b) => {
      const w: Record<string, number> = { alta: 0, media: 1, baja: 2 };
      return (w[a.severity ?? "baja"] ?? 3) - (w[b.severity ?? "baja"] ?? 3);
    });
  const equipos = items.filter((i) => i.category === "equipo");
  const normas = items.filter((i) => i.category === "norma");
  const entregables = items.filter((i) => i.category === "entregable");
  const alcance = items.filter((i) => i.category === "alcance" || i.category === "tarea");
  const sistemas = [...new Set(alcance.map((i) => i.system_type).filter(Boolean))] as string[];

  const footerRight = [reportFooter, taxId ? `RUC ${taxId}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document
      title={`Análisis de pliego — ${doc.project_title ?? doc.doc_name}`}
      author={brand.name}
    >
      <Page size="A4" style={s.page}>
        <PdfHeader
          brand={brand}
          title="Análisis de pliego de cargos"
          meta={[
            doc.analyzed_at
              ? formatDate(doc.analyzed_at.slice(0, 10), {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "",
          ]}
        />

        {/* Portada compacta */}
        <Text style={s.coverTitle}>{doc.project_title ?? doc.doc_name}</Text>
        <Text style={s.muted}>
          {[doc.contracting_entity, doc.location, doc.tender_ref ? `Ref. ${doc.tender_ref}` : null]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>

        {doc.executive_summary ? (
          <>
            <Text style={s.section}>Resumen ejecutivo</Text>
            {doc.executive_summary.split(/\n{2,}|\n(?=\S)/).map((p, i) => (
              <Text key={i} style={s.paragraph}>
                {p}
              </Text>
            ))}
          </>
        ) : null}

        <Text style={s.section}>
          Riesgos y condiciones económicas ({riesgos.length})
        </Text>
        {riesgos.length === 0 ? (
          <Text style={s.muted}>Sin riesgos detectados en el documento.</Text>
        ) : (
          riesgos.map((r) => (
            <View
              key={r.id}
              style={[s.riskBox, { borderLeftColor: SEV_COLOR[r.severity ?? "baja"] }]}
              wrap={false}
            >
              <View style={s.riskHead}>
                <Text style={[s.sevLabel, { color: SEV_COLOR[r.severity ?? "baja"] }]}>
                  {(r.severity ?? "").toUpperCase()}
                </Text>
                <Text style={s.muted}>
                  {SCOPE_CATEGORY_LABEL[r.category] ?? r.category}
                  {r.cost_impact ? "  ·  impacta costos" : ""}
                  {r.page_ref ? `  ·  ${r.page_ref}` : ""}
                </Text>
              </View>
              <Text style={{ lineHeight: 1.4 }}>{r.description}</Text>
              {r.quote ? <Text style={s.quote}>“{r.quote}”</Text> : null}
            </View>
          ))
        )}

        <Text style={s.section}>Sistemas y alcance</Text>
        {[...sistemas, null].map((sys) => {
          const rows = alcance.filter((i) => i.system_type === sys);
          if (!rows.length) return null;
          return (
            <View key={sys ?? "general"} style={{ marginBottom: 6 }}>
              <Text style={[s.th, { marginBottom: 2 }]}>
                {sys ? (SYSTEM_LABEL[sys] ?? sys).toUpperCase() : "GENERAL DEL PROYECTO"}
              </Text>
              {rows.map((i) => (
                <Text key={i.id} style={s.bullet}>
                  •  {i.description}
                  {i.page_ref ? `  (${i.page_ref})` : ""}
                </Text>
              ))}
            </View>
          );
        })}

        <Text style={s.section}>Equipos especificados ({equipos.length})</Text>
        {equipos.length > 0 ? (
          <>
            <View style={s.row}>
              <Text style={[s.cDesc, s.th]}>Equipo</Text>
              <Text style={[s.cSmall, s.th]}>Fabricante</Text>
              <Text style={[s.cSmall, s.th]}>Modelo</Text>
              <Text style={[s.cQty, s.th]}>Cant.</Text>
            </View>
            {equipos.map((e) => (
              <View key={e.id} style={s.row} wrap={false}>
                <Text style={s.cDesc}>{e.description}</Text>
                <Text style={s.cSmall}>{e.manufacturer ?? "—"}</Text>
                <Text style={s.cSmall}>{e.model ?? "—"}</Text>
                <Text style={s.cQty}>{e.qty_specified ?? "—"}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={s.muted}>El pliego no especifica equipos con fabricante/modelo.</Text>
        )}

        <Text style={s.section}>Normas y estándares</Text>
        {normas.length ? (
          normas.map((n) => (
            <Text key={n.id} style={s.bullet}>
              •  {n.description}
            </Text>
          ))
        ) : (
          <Text style={s.muted}>Sin normas explícitas.</Text>
        )}

        <Text style={s.section}>Entregables y condiciones</Text>
        {entregables.length ? (
          entregables.map((n) => (
            <Text key={n.id} style={s.bullet}>
              •  {n.description}
            </Text>
          ))
        ) : (
          <Text style={s.muted}>Sin entregables explícitos.</Text>
        )}

        <PdfFooter brand={brand} right={footerRight || undefined} />
      </Page>
    </Document>
  );
}
