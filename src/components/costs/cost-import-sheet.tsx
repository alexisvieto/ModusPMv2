"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toISODate } from "@/lib/calendar";
import { COST_CATEGORY, parseCategory } from "@/lib/costs";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Row = Record<string, unknown>;
type Target = "cost_code" | "description" | "category" | "budget" | "committed" | "actual";

const TARGETS: { key: Target; label: string }[] = [
  { key: "cost_code", label: "Código" },
  { key: "description", label: "Descripción" },
  { key: "category", label: "Categoría" },
  { key: "budget", label: "Presupuesto" },
  { key: "committed", label: "Comprometido" },
  { key: "actual", label: "Costo real" },
];

const GUESS: Record<Target, RegExp> = {
  cost_code: /(c[oó]digo|code|cuenta|partida)/i,
  description: /(descrip|concepto|detalle|[ií]tem)/i,
  category: /(categor|tipo|rubro)/i,
  budget: /(presupuesto|budget|planificado)/i,
  committed: /(comprometido|committed|orden|\bpo\b)/i,
  actual: /(real|actual|ejecutado|gastado|incurrido)/i,
};

const selectCls =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring";

function num(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function CostImportSheet({
  project,
  open,
  onOpenChange,
}: {
  project: { id: string; organization_id: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<Target, string>>({
    cost_code: "",
    description: "",
    category: "",
    budget: "",
    committed: "",
    actual: "",
  });
  const [importing, setImporting] = useState(false);

  function reset() {
    setFileName(null);
    setColumns([]);
    setRows([]);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const MAX_ROWS = 5000;
    if (f.size > MAX_SIZE) {
      toast.error("El archivo supera 5 MB. Redúcelo e intenta de nuevo.");
      e.target.value = "";
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      // cellFormula/cellHTML en false: no evaluamos fórmulas del Excel
      // (p. ej. =CMD(...) / =HYPERLINK(...)), solo leemos los valores.
      const wb = XLSX.read(buf, {
        type: "array",
        cellFormula: false,
        cellHTML: false,
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
      const json = all.slice(0, MAX_ROWS);
      const cols = json.length ? Object.keys(json[0]) : [];
      const auto: Record<Target, string> = {
        cost_code: "",
        description: "",
        category: "",
        budget: "",
        committed: "",
        actual: "",
      };
      for (const t of TARGETS) {
        auto[t.key] = cols.find((c) => GUESS[t.key].test(c)) ?? "";
      }
      setFileName(f.name);
      setColumns(cols);
      setRows(json);
      setMapping(auto);
      if (all.length > MAX_ROWS) {
        toast.warning("Se cargaron solo las primeras 5,000 filas del archivo.");
      }
    } catch {
      toast.error("No se pudo leer el archivo. Usa .xlsx, .xls o .csv.");
    }
  }

  function buildRows() {
    return rows
      .map((r, i) => {
        const code = mapping.cost_code
          ? String(r[mapping.cost_code] ?? "").trim()
          : "";
        const id = (code || `IMP-${i + 1}`).slice(0, 120);
        return {
          cost_code: id,
          description: mapping.description
            ? String(r[mapping.description] ?? "").slice(0, 500) || null
            : null,
          category: parseCategory(
            mapping.category ? String(r[mapping.category] ?? "") : "",
          ),
          budget: mapping.budget ? num(r[mapping.budget]) : 0,
          committed: mapping.committed ? num(r[mapping.committed]) : 0,
          actual: mapping.actual ? num(r[mapping.actual]) : 0,
          entry_date: toISODate(new Date()),
          external_id: id,
        };
      })
      .filter((row) => row.description || row.budget || row.actual);
  }

  async function runImport() {
    const toInsert = buildRows();
    if (toInsert.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    setImporting(true);
    const supabase = createClient();
    // RPC transaccional: limpia la importación previa (mismo código) e inserta
    // en una sola operación — un fallo a mitad ya no deja los costos a medias.
    const { error } = await supabase.rpc("import_cost_entries", {
      p_project_id: project.id,
      p_rows: toInsert,
    });
    setImporting(false);
    if (error) {
      toast.error("No se pudo importar. Revisa el mapeo.");
      return;
    }
    toast.success(`${toInsert.length} partidas importadas.`);
    reset();
    onOpenChange(false);
    router.refresh();
  }

  const preview = rows.slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Importar costos</SheetTitle>
          <SheetDescription>
            Excel o CSV de cualquier sistema (Peachtree, Odoo, hoja propia…).
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {rows.length === 0 ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground hover:bg-muted/40">
              <Upload className="size-6 text-primary" />
              <span className="font-medium text-foreground">
                Sube un archivo .xlsx, .xls o .csv
              </span>
              <span className="text-xs">
                La primera fila debe ser el encabezado de columnas.
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={onFile}
              />
            </label>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-primary" />
                  {fileName} · {rows.length} filas
                </span>
                <button
                  onClick={reset}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Mapeo de columnas */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Mapea tus columnas a los campos de costo
                </p>
                <div className="space-y-2">
                  {TARGETS.map((t) => (
                    <div key={t.key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm">{t.label}</span>
                      <select
                        className={selectCls}
                        value={mapping[t.key]}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [t.key]: e.target.value }))
                        }
                      >
                        <option value="">— sin mapear —</option>
                        {columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Vista previa (primeras 5)
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        {TARGETS.map((t) => (
                          <th key={t.key} className="px-2 py-1.5 font-medium">
                            {t.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-b last:border-b-0">
                          {TARGETS.map((t) => {
                            const raw = mapping[t.key]
                              ? String(r[mapping[t.key]] ?? "")
                              : "";
                            const val =
                              t.key === "category" && raw
                                ? COST_CATEGORY[parseCategory(raw)]
                                : raw || "—";
                            return (
                              <td key={t.key} className="px-2 py-1.5">
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={runImport}
            disabled={rows.length === 0 || importing}
          >
            {importing ? "Importando…" : `Importar ${rows.length || ""}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
