"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FileDown } from "lucide-react";

import {
  AnalysisPdfDocument,
  type AnalysisPdfData,
} from "./analysis-pdf-document";

const cls =
  "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60";

export function AnalysisPdfButton({
  data,
  fileName,
}: {
  data: AnalysisPdfData;
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
        <FileDown className="size-4" />
        Exportar PDF
      </button>
    );
  }

  return (
    <PDFDownloadLink
      document={<AnalysisPdfDocument data={data} />}
      fileName={fileName}
      className={cls}
    >
      {({ loading }) => (
        <>
          <FileDown className="size-4" />
          {loading ? "Generando…" : "Exportar PDF"}
        </>
      )}
    </PDFDownloadLink>
  );
}
