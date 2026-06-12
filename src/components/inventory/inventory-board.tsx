"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Package,
  Plus,
  ScanLine,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InventoryEditorSheet } from "@/components/inventory/inventory-editor-sheet";
import { ScanSheet } from "@/components/inventory/scan-sheet";
import { formatDate, formatNumber } from "@/lib/format";
import {
  CATEGORY_OPTIONS,
  INV_CATEGORY,
  INV_LOCATION,
  INV_STATUS,
  LOCATION_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/inventory";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];
type Project = { id: string; organization_id: string; name: string; code: string | null };
type TaskOpt = { id: string; wbs: string | null; name: string };

const selectCls =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring";

export function InventoryBoard({
  project,
  items,
  tasks,
  brand,
}: {
  project: Project;
  items: Item[];
  tasks: TaskOpt[];
  brand: Brand;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [loc, setLoc] = useState("");

  const taskById = useMemo(() => {
    const m = new Map<string, TaskOpt>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`inventory-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
          filter: `project_id=eq.${project.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (cat && it.category !== cat) return false;
      if (status && it.status !== status) return false;
      if (loc && it.location !== loc) return false;
      if (needle) {
        const hay = `${it.description} ${it.serial_number ?? ""} ${it.product_number ?? ""} ${it.brand_model ?? ""} ${it.supplier ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, cat, status, loc]);

  const kpis = useMemo(() => {
    const by = (s: string) => items.filter((it) => it.status === s).length;
    return {
      total: items.length,
      instalado: by("instalado"),
      por_recibir: by("por_recibir"),
      incidencias: by("faltante") + by("defectuoso"),
    };
  }, [items]);

  function openItem(it: Item) {
    setEditing(it);
    setOpen(true);
  }

  async function addItem() {
    const supabase = createClient();
    const { data } = await supabase
      .from("inventory_items")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        description: "Nuevo ítem",
        category: "equipo",
        quantity: 1,
        status: "por_recibir",
        location: "en_galera",
      })
      .select()
      .single();
    router.refresh();
    if (data) openItem(data);
  }

  async function createWithBarcode(barcode: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("inventory_items")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        description: "Nuevo ítem",
        category: "equipo",
        quantity: 1,
        status: "por_recibir",
        location: "en_galera",
        barcode,
      })
      .select()
      .single();
    router.refresh();
    if (data) openItem(data);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = filtered.map((it) => ({
      Nombre: it.equipment_name ?? "",
      Descripción: it.description,
      "Ubicación en rack": it.rack_position ?? "",
      "N° de producto": it.product_number ?? "",
      Serial: it.serial_number ?? "",
      "Marca/Modelo": it.brand_model ?? "",
      Categoría: INV_CATEGORY[it.category],
      Cantidad: Number(it.quantity),
      Estado: INV_STATUS[it.status].label,
      Ubicación: INV_LOCATION[it.location],
      Proveedor: it.supplier ?? "",
      "Tarea (WBS)": it.task_id ? (taskById.get(it.task_id)?.wbs ?? "") : "",
      Notas: it.notes ?? "",
    }));
    const ws = XLSX.utils.aoa_to_sheet([
      [brand.name],
      [`Inventario · ${project.name}`],
      [
        `Generado ${formatDate(new Date())}${
          brand.website ? ` · ${brand.website}` : ""
        }`,
      ],
      [],
    ]);
    XLSX.utils.sheet_add_json(ws, rows, { origin: "A5" });
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } },
    ];
    ws["!cols"] = [
      { wch: 16 },
      { wch: 42 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 9 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 8 },
      { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `Inventario_${project.code ?? "proyecto"}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total de ítems" value={kpis.total} icon={<Package className="size-4 text-muted-foreground" />} />
        <Kpi label="Instalados" value={kpis.instalado} valueClass="text-success" />
        <Kpi label="Por recibir" value={kpis.por_recibir} valueClass="text-warning" />
        <Kpi
          label="Incidencias"
          value={kpis.incidencias}
          valueClass={kpis.incidencias > 0 ? "text-destructive" : undefined}
          icon={
            kpis.incidencias > 0 ? (
              <AlertTriangle className="size-4 text-destructive" />
            ) : undefined
          }
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Toolbar */}
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
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Estado</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
            <select className={selectCls} value={loc} onChange={(e) => setLoc(e.target.value)}>
              <option value="">Ubicación</option>
              {LOCATION_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length} de {items.length}
              </span>
              <Button size="sm" onClick={() => setScanOpen(true)}>
                <ScanLine className="size-4" />
                Escanear
              </Button>
              <Button size="sm" variant="outline" onClick={exportExcel}>
                <Download className="size-4" />
                Excel
              </Button>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="size-4" />
                Ítem
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Serial</th>
                  <th className="px-3 py-2 font-medium">Marca / Modelo</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 text-right font-medium">Cant.</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const sm = INV_STATUS[it.status];
                  const task = it.task_id ? taskById.get(it.task_id) : null;
                  return (
                    <tr
                      key={it.id}
                      onClick={() => openItem(it)}
                      className="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.description}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {it.equipment_name && (
                            <span className="font-mono font-semibold text-primary">
                              {it.equipment_name}
                            </span>
                          )}
                          {it.product_number && <span>{it.product_number}</span>}
                          {task && (
                            <span className="rounded bg-primary/10 px-1 font-mono text-primary">
                              {task.wbs}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {it.serial_number || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {it.brand_model || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {INV_CATEGORY[it.category]}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(Number(it.quantity), 0)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            sm.className,
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", sm.dot)} />
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {it.rack_position && (
                          <span className="block font-mono text-xs text-foreground">
                            {it.rack_position}
                          </span>
                        )}
                        <span className="text-xs">{INV_LOCATION[it.location]}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {it.supplier || "—"}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      Sin ítems que coincidan con el filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <InventoryEditorSheet
        item={editing}
        tasks={tasks}
        open={open}
        onOpenChange={setOpen}
      />

      <ScanSheet
        items={items}
        open={scanOpen}
        onOpenChange={setScanOpen}
        onCreateNew={createWithBarcode}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className={cn("mt-2 text-2xl font-semibold tabular-nums", valueClass)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
