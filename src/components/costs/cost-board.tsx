"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CostChart } from "@/components/costs/cost-chart";
import { CostEditorSheet } from "@/components/costs/cost-editor-sheet";
import { CostImportSheet } from "@/components/costs/cost-import-sheet";
import {
  COST_CATEGORY,
  COST_CATEGORY_OPTIONS,
} from "@/lib/costs";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Cost = Database["public"]["Tables"]["cost_entries"]["Row"];
type Project = {
  id: string;
  organization_id: string;
  name: string;
  currency: string;
};

const selectCls =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring";

export function CostBoard({
  project,
  costs,
}: {
  project: Project;
  costs: Cost[];
}) {
  const router = useRouter();
  const cur = project.currency ?? "USD";
  const [editing, setEditing] = useState<Cost | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`costs-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cost_entries",
          filter: `project_id=eq.${project.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, router]);

  const totals = useMemo(() => {
    const t = costs.reduce(
      (a, c) => ({
        budget: a.budget + Number(c.budget),
        committed: a.committed + Number(c.committed),
        actual: a.actual + Number(c.actual),
      }),
      { budget: 0, committed: 0, actual: 0 },
    );
    return {
      ...t,
      execPct: t.budget ? (t.actual / t.budget) * 100 : 0,
      porGastar: t.budget - t.actual,
    };
  }, [costs]);

  const chartData = useMemo(
    () =>
      COST_CATEGORY_OPTIONS.map((o) => {
        const rows = costs.filter((c) => c.category === o.v);
        return {
          category: o.l,
          presupuesto: rows.reduce((a, c) => a + Number(c.budget), 0),
          real: rows.reduce((a, c) => a + Number(c.actual), 0),
        };
      }).filter((d) => d.presupuesto > 0 || d.real > 0),
    [costs],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return costs.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (needle) {
        const hay = `${c.cost_code ?? ""} ${c.description ?? ""} ${c.supplier ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [costs, q, cat]);

  function openCost(c: Cost) {
    setEditing(c);
    setOpen(true);
  }

  async function addCost() {
    if (creating) return;
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cost_entries")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        description: "Nueva partida",
        category: "other",
        budget: 0,
        committed: 0,
        actual: 0,
        source: "manual",
      })
      .select()
      .maybeSingle();
    setCreating(false);
    if (error || !data) {
      toast.error("No se pudo crear la partida.");
      return;
    }
    router.refresh();
    openCost(data);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Presupuesto" value={formatCompactCurrency(totals.budget, cur)} />
        <Kpi label="Comprometido" value={formatCompactCurrency(totals.committed, cur)} />
        <Kpi label="Costo real" value={formatCompactCurrency(totals.actual, cur)} />
        <Kpi
          label="% ejecutado"
          value={formatPercent(totals.execPct, 0)}
          valueClass={totals.execPct > 100 ? "text-destructive" : undefined}
        />
        <Kpi
          label="Por gastar"
          value={formatCompactCurrency(totals.porGastar, cur)}
          valueClass={totals.porGastar < 0 ? "text-destructive" : "text-success"}
        />
      </div>

      {/* Gráfica */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-1 text-sm font-semibold">Presupuesto vs real por categoría</h2>
          <CostChart data={chartData} />
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…"
                className="h-8 w-48 rounded-md border border-input bg-transparent pr-2 pl-8 text-xs outline-none focus-visible:border-ring"
              />
            </div>
            <select className={selectCls} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Categoría</option>
              {COST_CATEGORY_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length} de {costs.length}
              </span>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" />
                Importar
              </Button>
              <Button size="sm" onClick={addCost} disabled={creating}>
                <Plus className="size-4" />
                Partida
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 text-right font-medium">Presupuesto</th>
                  <th className="px-3 py-2 text-right font-medium">Comprometido</th>
                  <th className="px-3 py-2 text-right font-medium">Real</th>
                  <th className="px-3 py-2 text-right font-medium">Variación</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const variacion = Number(c.budget) - Number(c.actual);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openCost(c)}
                      className="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {c.cost_code || "—"}
                      </td>
                      <td className="px-3 py-2">{c.description || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.supplier || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {COST_CATEGORY[c.category]}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(Number(c.budget), cur)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(Number(c.committed), cur)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(Number(c.actual), cur)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          variacion < 0 ? "text-destructive" : "text-success",
                        )}
                      >
                        {formatCurrency(variacion, cur)}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                      Sin partidas. Agrega una o importa un Excel/CSV.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CostEditorSheet cost={editing} open={open} onOpenChange={setOpen} />
      <CostImportSheet
        project={{ id: project.id, organization_id: project.organization_id }}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Receipt className="size-3.5 text-muted-foreground" />
        </div>
        <p className={cn("mt-1.5 text-xl font-semibold tabular-nums", valueClass)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
