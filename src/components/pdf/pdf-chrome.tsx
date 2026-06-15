"use client";

import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

import { brandInitial, type Brand } from "@/lib/brand";

// Paleta de documento DERIVADA de la marca de cada tenant (multi-tenant):
// `navy` = color oscuro de la marca (titulares, cabecera de tabla, pie),
// `orange` = color primario (acentos: franjas, bordes, etiquetas).
// Así cada org exporta con SU branding (Ingesoft naranja, ModusPM demo teal…).
export function docPalette(brand: Brand) {
  return {
    navy: brand.dark,
    orange: brand.primary,
    text: "#333333",
    muted: "#6B7280",
    border: "#E5E7EB",
    light: "#F6F6F6",
    white: "#FFFFFF",
  };
}

export type DocPalette = ReturnType<typeof docPalette>;

const makeChrome = (P: DocPalette) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottomWidth: 2,
      borderBottomColor: P.orange,
      paddingBottom: 12,
      marginBottom: 16,
    },
    brandFallback: { flexDirection: "row", alignItems: "center", gap: 6 },
    mark: {
      width: 22,
      height: 22,
      backgroundColor: P.navy,
      borderRadius: 4,
      color: P.white,
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      paddingTop: 4,
    },
    brandName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: P.navy },
    logo: { height: 30, width: 108, objectFit: "contain" },
    headerRight: { alignItems: "flex-end" },
    docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: P.navy },
    metaLine: { color: P.muted, fontSize: 9, marginTop: 1 },
    footer: {
      position: "absolute",
      bottom: 18,
      left: 32,
      right: 32,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 2,
      borderTopColor: P.orange,
      paddingTop: 8,
      color: P.muted,
      fontSize: 8,
    },
    credit: {
      textAlign: "center",
      color: "#9CA3AF",
      fontSize: 7,
      marginTop: 3,
    },
  });

export function PdfHeader({
  brand,
  title,
  meta = [],
}: {
  brand: Brand;
  title: string;
  meta?: string[];
}) {
  const s = makeChrome(docPalette(brand));
  return (
    <View style={s.header}>
      {brand.logoUrl ? (
        // @react-pdf Image no es un <img> del DOM; alt-text no aplica.
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={brand.logoUrl} style={s.logo} />
      ) : (
        <View style={s.brandFallback}>
          <Text style={s.mark}>{brandInitial(brand)}</Text>
          <Text style={s.brandName}>{brand.name}</Text>
        </View>
      )}
      <View style={s.headerRight}>
        <Text style={s.docTitle}>{title}</Text>
        {meta.map((m, i) => (
          <Text key={i} style={s.metaLine}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function PdfFooter({ brand, right }: { brand: Brand; right?: string }) {
  const s = makeChrome(docPalette(brand));
  return (
    <View style={s.footer} fixed>
      <View style={s.footerRow}>
        <Text>
          {brand.name}
          {brand.website ? ` · ${brand.website}` : ""}
        </Text>
        <Text>{right ?? ""}</Text>
      </View>
      {brand.exportCredit && (
        <Text style={s.credit}>a product by Nexera · nexera.io</Text>
      )}
    </View>
  );
}
