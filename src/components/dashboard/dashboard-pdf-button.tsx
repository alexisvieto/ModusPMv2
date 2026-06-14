"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";

import {
  DashboardPdfDocument,
  type DashboardPdfData,
} from "./dashboard-pdf-document";

const cls =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60";

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
        <Download className="size-4" />
        Exportar PDF
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
          <Download className="size-4" />
          {loading ? "Generando…" : "Exportar PDF"}
        </>
      )}
    </PDFDownloadLink>
  );
}
