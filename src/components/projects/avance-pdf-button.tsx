"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";

import { AvancePdfDocument, type AvancePdfData } from "./avance-pdf-document";

const cls =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60";

export default function AvancePdfButton({
  data,
  fileName,
}: {
  data: AvancePdfData;
  fileName: string;
}) {
  // PDFDownloadLink es solo-cliente; montamos tras hidratar.
  const [mounted, setMounted] = useState(false);
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
      document={<AvancePdfDocument data={data} />}
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
