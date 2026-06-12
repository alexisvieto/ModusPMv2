"use client";

import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

import { brandInitial, type Brand } from "@/lib/brand";

// Paleta "documentos oficiales" del BRANDING GUIDE de Ingesoft (navy + naranja).
// Compartida por TODOS los PDF para que se vean idénticos. La UI de la app usa
// la paleta clásica de la marca; esto aplica solo a los exportables.
// Para multi-tenant real, debería migrar a una config de marca-de-documento por org.
export const DOC = {
  navy: "#071D4C",
  orange: "#FF9A00",
  text: "#333333",
  muted: "#6B7280",
  border: "#E5E7EB",
  light: "#F6F6F6",
  white: "#FFFFFF",
} as const;

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: DOC.orange,
    paddingBottom: 12,
    marginBottom: 16,
  },
  brandFallback: { flexDirection: "row", alignItems: "center", gap: 6 },
  mark: {
    width: 22,
    height: 22,
    backgroundColor: DOC.navy,
    borderRadius: 4,
    color: DOC.white,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 4,
  },
  brandName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DOC.navy },
  logo: { height: 30, width: 108, objectFit: "contain" },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: DOC.navy },
  metaLine: { color: DOC.muted, fontSize: 9, marginTop: 1 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: DOC.orange,
    paddingTop: 8,
    color: DOC.muted,
    fontSize: 8,
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
  return (
    <View style={s.header}>
      {brand.logoUrl ? (
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
  return (
    <View style={s.footer} fixed>
      <Text>
        {brand.name}
        {brand.website ? ` · ${brand.website}` : ""}
      </Text>
      <Text>{right ?? "División de Telecomunicaciones y Sistemas Especiales"}</Text>
    </View>
  );
}
