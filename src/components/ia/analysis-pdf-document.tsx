"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { type Brand } from "@/lib/brand";
import {
  docPalette,
  type DocPalette,
  PdfFooter,
  PdfHeader,
} from "@/components/pdf/pdf-chrome";

export type AnalysisPdfData = {
  brand: Brand;
  project: { name: string; code: string | null };
  generatedAt: string;
  analysis: {
    titular: string;
    estado: string;
    riesgos: string[];
    recomendaciones: string[];
  };
};

// Estilo editorial: kicker en versalitas, titular grande a modo de
// encabezado de artículo, párrafo de entrada con aire, y listas
// numeradas con folio de dos dígitos en el color de la marca.
const makeStyles = (P: DocPalette) =>
  StyleSheet.create({
    page: { padding: 32, paddingBottom: 64, fontSize: 10, color: P.text, fontFamily: "Helvetica" },
    kicker: {
      fontSize: 8,
      letterSpacing: 2,
      color: P.orange,
      fontFamily: "Helvetica-Bold",
      textTransform: "uppercase",
      marginTop: 6,
      marginBottom: 8,
    },
    headline: {
      fontSize: 21,
      lineHeight: 1.25,
      fontFamily: "Helvetica-Bold",
      color: P.navy,
      marginBottom: 10,
    },
    headlineRule: { width: 56, height: 3, backgroundColor: P.orange, marginBottom: 14 },
    lead: {
      fontSize: 11,
      lineHeight: 1.65,
      color: P.text,
      textAlign: "justify",
      marginBottom: 6,
    },
    section: { marginTop: 18 },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      color: P.navy,
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: P.border,
      marginBottom: 10,
    },
    item: { flexDirection: "row", gap: 10, marginBottom: 9 },
    itemNumber: {
      width: 22,
      fontSize: 13,
      fontFamily: "Helvetica-Bold",
      color: P.orange,
    },
    itemText: { flex: 1, fontSize: 10, lineHeight: 1.55, textAlign: "justify" },
    disclaimer: {
      marginTop: 22,
      borderTopWidth: 1,
      borderTopColor: P.border,
      paddingTop: 8,
      fontSize: 8,
      lineHeight: 1.5,
      color: P.muted,
      fontFamily: "Helvetica-Oblique",
    },
  });

function NumberedList({
  items,
  s,
}: {
  items: string[];
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <>
      {items.map((text, i) => (
        <View key={i} style={s.item} wrap={false}>
          <Text style={s.itemNumber}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={s.itemText}>{text}</Text>
        </View>
      ))}
    </>
  );
}

export function AnalysisPdfDocument({ data }: { data: AnalysisPdfData }) {
  const { brand, project, analysis } = data;
  const P = docPalette(brand);
  const s = makeStyles(P);
  return (
    <Document title={`Análisis ejecutivo IA — ${project.name}`} author={brand.name}>
      <Page size="A4" style={s.page}>
        <PdfHeader
          brand={brand}
          title="Análisis Ejecutivo · IA"
          meta={[`Generado ${data.generatedAt}`]}
        />

        <Text style={s.kicker}>
          {[project.code, project.name].filter(Boolean).join("  ·  ")}
        </Text>
        <Text style={s.headline}>{analysis.titular || "Análisis del proyecto"}</Text>
        <View style={s.headlineRule} />

        {analysis.estado ? <Text style={s.lead}>{analysis.estado}</Text> : null}

        {analysis.riesgos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Riesgos</Text>
            <NumberedList items={analysis.riesgos} s={s} />
          </View>
        )}

        {analysis.recomendaciones.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recomendaciones</Text>
            <NumberedList items={analysis.recomendaciones} s={s} />
          </View>
        )}

        <Text style={s.disclaimer}>
          Este análisis fue generado por inteligencia artificial a partir de los
          datos del proyecto (avance, SPI/CPI, pendientes y costos) a la fecha de
          emisión. Revíselo con criterio profesional antes de tomar decisiones.
        </Text>

        <PdfFooter brand={brand} right={project.code ?? undefined} />
      </Page>
    </Document>
  );
}
