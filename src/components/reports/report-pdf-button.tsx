"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";

import {
  ReportPdfDocument,
  type ReportPdfData,
} from "./report-pdf-document";

export default function ReportPdfButton({
  data,
  fileName,
  label = "Descargar PDF",
}: {
  data: ReportPdfData;
  fileName: string;
  label?: string;
}) {
  return (
    <PDFDownloadLink
      document={<ReportPdfDocument data={data} />}
      fileName={fileName}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      {({ loading }) => (
        <>
          <Download className="size-4" />
          {loading ? "Generando…" : label}
        </>
      )}
    </PDFDownloadLink>
  );
}
