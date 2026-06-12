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
    // Paleta "documentos oficiales" del BRANDING GUIDE de Ingesoft
    // (azul marino + naranja). Es específica del exportable: el resto de la
    // app usa la paleta clásica de la marca. Si se vuelve multi-tenant,
    // esto debería migrar a una config de marca-de-documento por org.
    const NAVY = "FF071D4C";
    const ORANGE = "FFFF9A00";
    const TEXT = "FF333333";
    const ZEBRA = "FFF6F6F6";
    const WHITE = "FFFFFFFF";
    const FONT = "Archivo";
    const FONT_BLACK = "Archivo Black";

    const excelMod: { default?: unknown } = await import("exceljs");
    // El build de navegador puede exponer el namespace como default.
    const ExcelJS = (excelMod.default ?? excelMod) as {
      Workbook: new () => Record<string, unknown>;
    };
    // A partir de aquí trabajamos con la API de ExcelJS (tipos laxos).
    const wb = new ExcelJS.Workbook() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ws = wb.addWorksheet("Inventario", {
      views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    ws.columns = [
      { width: 18 }, // Nombre
      { width: 40 }, // Descripción
      { width: 18 }, // Ubicación en rack
      { width: 18 }, // N° de producto
      { width: 16 }, // Serial
      { width: 18 }, // Marca/Modelo
      { width: 13 }, // Categoría
      { width: 10 }, // Cantidad
      { width: 14 }, // Estado
      { width: 14 }, // Ubicación
      { width: 16 }, // Proveedor
      { width: 11 }, // Tarea (WBS)
      { width: 32 }, // Notas
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paint = (
      c: any,
      o: { v?: string | number; font?: unknown; fill?: string; align?: unknown; border?: unknown },
    ) => {
      if (o.v !== undefined) c.value = o.v;
      if (o.font) c.font = o.font;
      if (o.fill)
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
      if (o.align) c.alignment = o.align;
      if (o.border) c.border = o.border;
    };

    // ── Encabezado: logo (incluye el slogan "Endless Possibilities") ──
    try {
      const res = await fetch(brand.logoUrl ?? "/ingesoft-logo.png");
      if (res.ok) {
        const blob = await res.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () =>
            resolve(String(fr.result).replace(/^data:image\/\w+;base64,/, ""));
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        const imgId = wb.addImage({ base64, extension: "png" });
        // Logo 1101×320 → 280×81 px (conserva proporción)
        ws.addImage(imgId, {
          tl: { col: 0, row: 0 },
          ext: { width: 280, height: 81 },
          editAs: "oneCell",
        });
      }
    } catch {
      // sin logo: el documento se genera igual
    }

    const rightMid = { vertical: "middle", horizontal: "right" };
    ws.mergeCells("E1:M1");
    paint(ws.getCell("E1"), {
      v: brand.name,
      font: { name: FONT_BLACK, size: 16, bold: true, color: { argb: NAVY } },
      align: rightMid,
    });
    ws.mergeCells("E2:M2");
    paint(ws.getCell("E2"), {
      v: brand.website ?? "",
      font: { name: FONT, size: 10, color: { argb: TEXT } },
      align: rightMid,
    });
    ws.mergeCells("E3:M3");
    paint(ws.getCell("E3"), {
      v: [brand.email, brand.phone].filter(Boolean).join("   ·   "),
      font: { name: FONT, size: 10, color: { argb: TEXT } },
      align: rightMid,
    });
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 18;

    // ── Franja naranja separadora ──
    ws.mergeCells("A4:M4");
    ws.getRow(4).height = 5;
    paint(ws.getCell("A4"), { fill: ORANGE });

    // ── Título + fecha ──
    ws.mergeCells("A5:I5");
    paint(ws.getCell("A5"), {
      v: `Inventario · ${project.name}`,
      font: { name: FONT_BLACK, size: 13, bold: true, color: { argb: NAVY } },
      align: { vertical: "middle" },
    });
    ws.mergeCells("J5:M5");
    paint(ws.getCell("J5"), {
      v: `Generado ${formatDate(new Date())}`,
      font: { name: FONT, size: 10, color: { argb: TEXT } },
      align: rightMid,
    });
    ws.getRow(5).height = 24;

    // ── Cabecera de tabla (azul marino, texto blanco, borde naranja) ──
    const headers = [
      "Nombre",
      "Descripción",
      "Ubicación en rack",
      "N° de producto",
      "Serial",
      "Marca/Modelo",
      "Categoría",
      "Cantidad",
      "Estado",
      "Ubicación",
      "Proveedor",
      "Tarea (WBS)",
      "Notas",
    ];
    const headRow = ws.getRow(6);
    headers.forEach((h, i) => {
      paint(headRow.getCell(i + 1), {
        v: h,
        font: { name: FONT, size: 10, bold: true, color: { argb: WHITE } },
        fill: NAVY,
        align: {
          vertical: "middle",
          horizontal: i === 7 ? "center" : "left",
          wrapText: true,
        },
        border: { bottom: { style: "medium", color: { argb: ORANGE } } },
      });
    });
    headRow.height = 22;

    // ── Filas de datos (zebra) ──
    filtered.forEach((it, idx) => {
      const r = ws.getRow(7 + idx);
      const vals: (string | number)[] = [
        it.equipment_name ?? "",
        it.description,
        it.rack_position ?? "",
        it.product_number ?? "",
        it.serial_number ?? "",
        it.brand_model ?? "",
        INV_CATEGORY[it.category],
        Number(it.quantity),
        INV_STATUS[it.status].label,
        INV_LOCATION[it.location],
        it.supplier ?? "",
        it.task_id ? (taskById.get(it.task_id)?.wbs ?? "") : "",
        it.notes ?? "",
      ];
      vals.forEach((v, i) => {
        paint(r.getCell(i + 1), {
          v,
          font: { name: FONT, size: 10, color: { argb: TEXT } },
          fill: idx % 2 === 1 ? ZEBRA : undefined,
          align: {
            vertical: "middle",
            horizontal: i === 7 ? "center" : "left",
            wrapText: i === 1 || i === 12,
          },
          border: { bottom: { style: "thin", color: { argb: "FFE5E5E5" } } },
        });
      });
      r.height = 16;
    });

    // ── Pie de página (gris oscuro, texto blanco) con franja naranja ──
    const lastRow = 6 + filtered.length;
    const stripe = lastRow + 1;
    ws.mergeCells(stripe, 1, stripe, 13);
    ws.getRow(stripe).height = 5;
    paint(ws.getCell(stripe, 1), { fill: ORANGE });
    const foot = stripe + 1;
    ws.mergeCells(foot, 1, foot, 13);
    paint(ws.getCell(foot, 1), {
      v: `${brand.name} · División de Telecomunicaciones y Sistemas Especiales`,
      font: { name: FONT, size: 9, color: { argb: WHITE } },
      fill: TEXT,
      align: { vertical: "middle", horizontal: "center" },
    });
    ws.getRow(foot).height = 20;

    // ── Descarga ──
    const out = await wb.xlsx.writeBuffer();
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Inventario_${project.code ?? "proyecto"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
