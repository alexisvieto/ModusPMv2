"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";

import { FatsatPdfDocument, type FatsatPdfData } from "./fatsat-pdf-document";

export default function FatsatPdfButton({
  data,
  fileName,
}: {
  data: FatsatPdfData;
  fileName: string;
}) {
  return (
    <PDFDownloadLink
      document={<FatsatPdfDocument data={data} />}
      fileName={fileName}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/20"
    >
      {({ loading }) => (
        <>
          <Download className="size-3.5" />
          {loading ? "…" : "PDF"}
        </>
      )}
    </PDFDownloadLink>
  );
}
