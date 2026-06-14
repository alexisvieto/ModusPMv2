"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Sparkles } from "lucide-react";

import {
  DashboardPdfDocument,
  type DashboardPdfData,
} from "./dashboard-pdf-document";

const cls =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60";

export default function DashboardPdfButton({
  data,
  fileName,
}: {
  data: DashboardPdfData;
  fileName: string;
}) {
  // PDFDownloadLink solo puede renderizar en el cliente; evitamos el SSR.
  const [mounted, setMounted] = useState(false);
  // Hidratación: PDFDownloadLink es solo-cliente; montamos tras hidratar.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button type="button" disabled className={cls}>
        <Sparkles className="size-4" />
        Análisis de Proyecto
      </button>
    );
  }

  return (
    <PDFDownloadLink
      document={<DashboardPdfDocument data={data} />}
      fileName={fileName}
      className={cls}
    >
      {({ loading }) => (
        <>
          <Sparkles className="size-4" />
          {loading ? "Generando…" : "Análisis de Proyecto"}
        </>
      )}
    </PDFDownloadLink>
  );
}
