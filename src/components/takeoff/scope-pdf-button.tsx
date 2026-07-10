"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";

import { ScopeReportPdfDocument, type ScopePdfData } from "./scope-report-pdf";

export default function ScopePdfButton({
  data,
  fileName,
}: {
  data: ScopePdfData;
  fileName: string;
}) {
  return (
    <PDFDownloadLink
      document={<ScopeReportPdfDocument data={data} />}
      fileName={fileName}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      {({ loading }) => (
        <>
          <Download className="size-4" />
          {loading ? "Generando…" : "Exportar informe"}
        </>
      )}
    </PDFDownloadLink>
  );
}
