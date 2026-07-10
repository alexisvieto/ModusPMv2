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
type Summary = Database["public"]["Functions"]["cost_summary"]["Returns"][number];
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
  summary,
  totalCount,
  pageSize,
}: {
  project: Project;
  costs: Cost[];
  summary: Summary[];
  totalCount: number;
  pageSize: number;
}) {
  const router = useRouter();
  const cur = project.currency ?? "USD";
  const [editing, setEditing] = useState<Cost | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  // Filas cargadas (primera página + "Cargar más"). Cuando el server refresca
  // los props (realtime/edición), se resincroniza a la primera página.
  const [rows, setRows] = useState(costs);
  const [prevCosts, setPrevCosts] = useState(costs);
  if (prevCosts !== costs) {
    setPrevCosts(costs);
    setRows(costs);
  }

  // Búsqueda en el servidor cuando hay filas sin cargar: si todo está en el
  // cliente, buscar local; si no, la búsqueda local mentiría.
  const needle = q.trim();
  const needsServerSearch = needle.length > 0 && rows.length < totalCount;
  const [serverHits, setServerHits] = useState<Cost[] | null>(null);

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

  useEffect(() => {
    if (!needsServerSearch) return;
    // PostgREST: se escapan los comodines de ilike y se neutralizan los
    // separadores de la sintaxis .or() (coma y paréntesis).
    const esc = needle.replace(/[\\%_]/g, "\\$&").replace(/[,()]/g, " ");
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("cost_entries")
        .select("*")
        .eq("project_id", project.id)
        .or(
          `cost_code.ilike.%${esc}%,description.ilike.%${esc}%,supplier.ilike.%${esc}%`,
        )
        .order("cost_code", { ascending: true })
        .limit(300);
      setServerHits(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [needle, needsServerSearch, project.id]);

  // KPIs y gráfica desde los agregados de BD (exactos con la tabla paginada).
  const totals = useMemo(() => {
    const t = summary.reduce(
      (a, s) => ({
        budget: a.budget + Number(s.budget),
        committed: a.committed + Number(s.committed),
        actual: a.actual + Number(s.actual),
      }),
      { budget: 0, committed: 0, actual: 0 },
    );
    return {
      ...t,
      execPct: t.budget ? (t.actual / t.budget) * 100 : 0,
      porGastar: t.budget - t.actual,
    };
  }, [summary]);

  const chartData = useMemo(
    () =>
      COST_CATEGORY_OPTIONS.map((o) => {
        const s = summary.find((x) => x.category === o.v);
        return {
          category: o.l,
          presupuesto: Number(s?.budget ?? 0),
          real: Number(s?.actual ?? 0),
        };
      }).filter((d) => d.presupuesto > 0 || d.real > 0),
    [summary],
  );

  const filtered = useMemo(() => {
    const source = needsServerSearch && serverHits ? serverHits : rows;
    const low = needle.toLowerCase();
    return source.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (low) {
        const hay = `${c.cost_code ?? ""} ${c.description ?? ""} ${c.supplier ?? ""}`.toLowerCase();
        if (!hay.includes(low)) return false;
      }
      return true;
    });
  }, [rows, serverHits, needsServerSearch, needle, cat]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const from = rows.length;
    const { data, error } = await createClient()
      .from("cost_entries")
      .select("*")
      .eq("project_id", project.id)
      .order("cost_code", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    setLoadingMore(false);
    if (error) {
      toast.error("No se pudieron cargar más partidas.");
      return;
    }
    setRows((r) => [...r, ...(data ?? [])]);
  }

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
                {filtered.length} de {totalCount}
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

          {!needsServerSearch && rows.length < totalCount && (
            <div className="border-t p-3 text-center">
              <Button
                size="sm"
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Cargando…"
                  : `Cargar más (${rows.length} de ${totalCount})`}
              </Button>
            </div>
          )}
          {needsServerSearch && (
            <p className="border-t p-3 text-center text-xs text-muted-foreground">
              Resultados buscados en todas las partidas del proyecto.
            </p>
          )}
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
