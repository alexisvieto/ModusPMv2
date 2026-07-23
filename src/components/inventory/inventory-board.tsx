"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  Download,
  Package,
  Plus,
  ScanLine,
  Search,
  Undo2,
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
  const [spareOpen, setSpareOpen] = useState(false);
  const [spareModel, setSpareModel] = useState("");
  const [spareQty, setSpareQty] = useState("");
  const [useOpen, setUseOpen] = useState(false);
  const [useModel, setUseModel] = useState("");
  const [useQty, setUseQty] = useState("");
  const [useNote, setUseNote] = useState("");

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
    const spareU = items
      .filter((it) => it.status === "spare")
      .reduce((s, it) => s + Number(it.quantity), 0);
    return {
      total: items.length,
      instalado: by("instalado"),
      por_recibir: by("por_recibir"),
      spare: spareU,
      incidencias: by("faltante") + by("defectuoso"),
    };
  }, [items]);

  // Ítems normales vs spare (los spare van en una sección aparte al final).
  const filteredNormal = useMemo(
    () => filtered.filter((it) => it.status !== "spare"),
    [filtered],
  );
  const filteredSpare = useMemo(
    () => filtered.filter((it) => it.status === "spare"),
    [filtered],
  );

  // Modelos disponibles para marcar spare (no-spare), con cantidad instalada.
  const spareModels = useMemo(() => {
    const m = new Map<string, { description: string; product: string; qty: number }>();
    for (const it of items) {
      if (it.status === "spare") continue;
      const key = `${it.description}||${it.product_number ?? ""}`;
      const e = m.get(key) ?? { description: it.description, product: it.product_number ?? "", qty: 0 };
      e.qty += Number(it.quantity);
      m.set(key, e);
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.description.localeCompare(b.description));
  }, [items]);

  // Modelos que HAY en spare, con unidades disponibles: origen para "Usar spare".
  const usableSpare = useMemo(() => {
    const m = new Map<string, { description: string; product: string; qty: number }>();
    for (const it of items) {
      if (it.status !== "spare") continue;
      const key = `${it.description}||${it.product_number ?? ""}`;
      const e = m.get(key) ?? { description: it.description, product: it.product_number ?? "", qty: 0 };
      e.qty += Number(it.quantity);
      m.set(key, e);
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.description.localeCompare(b.description));
  }, [items]);

  async function submitSpare() {
    const m = spareModels.find((x) => x.key === spareModel);
    const qty = Number(spareQty);
    if (!m) return toast.error("Elegí un ítem.");
    if (!qty || qty <= 0) return toast.error("Cantidad inválida.");
    if (qty > m.qty) return toast.error(`Solo hay ${m.qty} disponibles de ese ítem.`);
    const supabase = createClient();
    const { error } = await supabase.rpc("inventory_mark_spare", {
      p_project: project.id,
      p_description: m.description,
      p_product: m.product,
      p_qty: qty,
    });
    if (error) {
      toast.error("No se pudo marcar el spare.");
      return;
    }
    toast.success(`${qty} u de "${m.description}" a spare.`);
    setSpareModel("");
    setSpareQty("");
    router.refresh();
  }

  async function submitUseSpare() {
    const m = usableSpare.find((x) => x.key === useModel);
    const qty = Number(useQty);
    if (!m) return toast.error("Elegí un repuesto.");
    if (!qty || qty <= 0) return toast.error("Cantidad inválida.");
    if (qty > m.qty) return toast.error(`Solo hay ${m.qty} en spare de ese ítem.`);
    const supabase = createClient();
    const { error } = await supabase.rpc("inventory_use_spare", {
      p_project: project.id,
      p_description: m.description,
      p_product: m.product,
      p_qty: qty,
      p_note: useNote.trim() || undefined,
    });
    if (error) {
      toast.error("No se pudo usar el spare.");
      return;
    }
    toast.success(`${qty} u de "${m.description}" a instalado.`);
    setUseModel("");
    setUseQty("");
    setUseNote("");
    setUseOpen(false);
    router.refresh();
  }

  function openItem(it: Item) {
    setEditing(it);
    setOpen(true);
  }

  async function addItem() {
    const supabase = createClient();
    const { data, error } = await supabase
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
      .maybeSingle();
    if (error) {
      toast.error("No se pudo crear el ítem.");
      return;
    }
    router.refresh();
    if (data) openItem(data);
  }

  async function createWithBarcode(barcode: string) {
    const supabase = createClient();
    const { data, error } = await supabase
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
      .maybeSingle();
    if (error) {
      toast.error("No se pudo crear el ítem.");
      return;
    }
    router.refresh();
    if (data) openItem(data);
  }

  async function exportExcel() {
    try {
      await buildAndDownloadExcel();
    } catch {
      toast.error("No se pudo generar el archivo Excel.");
    }
  }

  async function buildAndDownloadExcel() {
    // Colores de marca del tenant (ARGB): NAVY = oscuro, ORANGE = primario.
    const toARGB = (hex: string) => {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
      return "FF" + full.toUpperCase();
    };
    const NAVY = toARGB(brand.dark);
    const ORANGE = toARGB(brand.primary);
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
      { width: 16 }, // iLO User
      { width: 18 }, // iLO Password
      { width: 30 }, // iLO Licencia
    ];

    const paint = (
      c: {
        value?: unknown;
        font?: unknown;
        fill?: unknown;
        alignment?: unknown;
        border?: unknown;
      },
      o: { v?: string | number; font?: unknown; fill?: string; align?: unknown; border?: unknown },
    ) => {
      if (o.v !== undefined) c.value = o.v;
      if (o.font) c.font = o.font;
      if (o.fill)
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
      if (o.align) c.alignment = o.align;
      if (o.border) c.border = o.border;
    };

    // ── Encabezado: logo de la organización (si está configurado) ──
    try {
      const res = brand.logoUrl ? await fetch(brand.logoUrl) : null;
      if (res?.ok) {
        const blob = await res.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () =>
            resolve(String(fr.result).replace(/^data:image\/\w+;base64,/, ""));
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        const extension = blob.type === "image/jpeg" ? "jpeg" : "png";
        const imgId = wb.addImage({ base64, extension });
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
    ws.mergeCells("E1:P1");
    paint(ws.getCell("E1"), {
      v: brand.name,
      font: { name: FONT_BLACK, size: 16, bold: true, color: { argb: NAVY } },
      align: rightMid,
    });
    ws.mergeCells("E2:P2");
    paint(ws.getCell("E2"), {
      v: brand.website ?? "",
      font: { name: FONT, size: 10, color: { argb: TEXT } },
      align: rightMid,
    });
    ws.mergeCells("E3:P3");
    paint(ws.getCell("E3"), {
      v: [brand.email, brand.phone].filter(Boolean).join("   ·   "),
      font: { name: FONT, size: 10, color: { argb: TEXT } },
      align: rightMid,
    });
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 18;

    // ── Franja naranja separadora ──
    ws.mergeCells("A4:P4");
    ws.getRow(4).height = 5;
    paint(ws.getCell("A4"), { fill: ORANGE });

    // ── Título + fecha ──
    ws.mergeCells("A5:K5");
    paint(ws.getCell("A5"), {
      v: `Inventario · ${project.name}`,
      font: { name: FONT_BLACK, size: 13, bold: true, color: { argb: NAVY } },
      align: { vertical: "middle" },
    });
    ws.mergeCells("L5:P5");
    paint(ws.getCell("L5"), {
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
      "iLO User",
      "iLO Password",
      "iLO Licencia",
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

    // iLO: las credenciales no vienen en el listado (seguridad); se cargan
    // solo al exportar, para los equipos visibles.
    const iloById = new Map<
      string,
      { ilo_user: string | null; ilo_password: string | null; ilo_license: string | null }
    >();
    const equipoIds = filtered
      .filter((it) => it.category === "equipo")
      .map((it) => it.id);
    if (equipoIds.length) {
      // En tandas: PostgREST manda los IDs en el query string y con cientos
      // de equipos la URL excede el límite y la consulta falla.
      const supabase = createClient();
      for (let i = 0; i < equipoIds.length; i += 100) {
        const { data: iloRows } = await supabase
          .from("inventory_items")
          .select("id, ilo_user, ilo_password, ilo_license")
          .eq("project_id", project.id)
          .in("id", equipoIds.slice(i, i + 100));
        for (const r of iloRows ?? []) iloById.set(r.id, r);
      }
    }

    // ── Filas de datos (zebra) ── Instalados primero; luego sección SPARE. ──
    let rowIdx = 7;
    const writeItem = (it: Item, zebra: boolean) => {
      const r = ws.getRow(rowIdx);
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
        iloById.get(it.id)?.ilo_user ?? "",
        iloById.get(it.id)?.ilo_password ?? "",
        iloById.get(it.id)?.ilo_license ?? "",
      ];
      vals.forEach((v, i) => {
        paint(r.getCell(i + 1), {
          v,
          font: { name: FONT, size: 10, color: { argb: TEXT } },
          fill: zebra ? ZEBRA : undefined,
          align: {
            vertical: "middle",
            horizontal: i === 7 ? "center" : "left",
            wrapText: i === 1 || i === 12,
          },
          border: { bottom: { style: "thin", color: { argb: "FFE5E5E5" } } },
        });
      });
      r.height = 16;
      rowIdx++;
    };

    filteredNormal.forEach((it, i) => writeItem(it, i % 2 === 1));

    if (filteredSpare.length) {
      // Encabezado de la sección SPARE (repuestos para el cliente).
      ws.mergeCells(rowIdx, 1, rowIdx, 16);
      paint(ws.getCell(rowIdx, 1), {
        v: "SPARE — Repuestos disponibles",
        font: { name: FONT_BLACK, size: 11, bold: true, color: { argb: NAVY } },
        fill: "FFEFF3F8",
        align: { vertical: "middle" },
      });
      ws.getRow(rowIdx).height = 20;
      rowIdx++;
      filteredSpare.forEach((it, i) => writeItem(it, i % 2 === 1));
    }

    // ── Pie de página (gris oscuro, texto blanco) con franja naranja ──
    const lastRow = rowIdx - 1;
    const stripe = lastRow + 1;
    ws.mergeCells(stripe, 1, stripe, 16);
    ws.getRow(stripe).height = 5;
    paint(ws.getCell(stripe, 1), { fill: ORANGE });
    const foot = stripe + 1;
    ws.mergeCells(foot, 1, foot, 16);
    paint(ws.getCell(foot, 1), {
      v: `${brand.name}${brand.website ? ` · ${brand.website}` : ""}`,
      font: { name: FONT, size: 9, color: { argb: WHITE } },
      fill: TEXT,
      align: { vertical: "middle", horizontal: "center" },
    });
    ws.getRow(foot).height = 20;

    // Crédito discreto de Nexera (subordinado a la marca del cliente; el tier "full" lo apaga).
    if (brand.exportCredit) {
      const credit = foot + 1;
      ws.mergeCells(credit, 1, credit, 16);
      paint(ws.getCell(credit, 1), {
        v: "a product by Nexera · nexera.io",
        font: { name: FONT, size: 8, italic: true, color: { argb: "FF9CA3AF" } },
        align: { vertical: "middle", horizontal: "center" },
      });
      ws.getRow(credit).height = 14;
    }

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

  const renderRow = (it: Item) => {
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
              <span className="font-mono font-semibold text-primary">{it.equipment_name}</span>
            )}
            {it.product_number && <span>{it.product_number}</span>}
            {task && <span className="rounded bg-primary/10 px-1 font-mono text-primary">{task.wbs}</span>}
          </div>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{it.serial_number || "—"}</td>
        <td className="px-3 py-2 text-muted-foreground">{it.brand_model || "—"}</td>
        <td className="px-3 py-2 text-muted-foreground">{INV_CATEGORY[it.category]}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(Number(it.quantity), 0)}</td>
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
            <span className="block font-mono text-xs text-foreground">{it.rack_position}</span>
          )}
          <span className="text-xs">{INV_LOCATION[it.location]}</span>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{it.supplier || "—"}</td>
      </tr>
    );
  };

  const renderCard = (it: Item) => {
    const sm = INV_STATUS[it.status];
    const task = it.task_id ? taskById.get(it.task_id) : null;
    return (
      <button
        key={it.id}
        onClick={() => openItem(it)}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">{it.description}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {it.equipment_name && (
                <span className="font-mono font-semibold text-primary">{it.equipment_name}</span>
              )}
              {it.product_number && <span>{it.product_number}</span>}
              {task && <span className="rounded bg-primary/10 px-1 font-mono text-primary">{task.wbs}</span>}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              sm.className,
            )}
          >
            <span className={cn("size-1.5 rounded-full", sm.dot)} />
            {sm.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <CellField label="Serial" value={it.serial_number || "—"} mono />
          <CellField label="Cant." value={formatNumber(Number(it.quantity), 0)} />
          <CellField label="Marca / Modelo" value={it.brand_model || "—"} />
          <CellField label="Categoría" value={INV_CATEGORY[it.category]} />
          <CellField
            label="Ubicación"
            value={`${it.rack_position ? it.rack_position + " · " : ""}${INV_LOCATION[it.location]}`}
          />
          <CellField label="Proveedor" value={it.supplier || "—"} />
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total de ítems" value={kpis.total} icon={<Package className="size-4 text-muted-foreground" />} />
        <Kpi label="Instalados" value={kpis.instalado} valueClass="text-success" />
        <Kpi label="Por recibir" value={kpis.por_recibir} valueClass="text-warning" />
        <Kpi label="Spare (u)" value={kpis.spare} valueClass="text-primary" icon={<Boxes className="size-4 text-primary" />} />
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
              <Button size="sm" variant="outline" onClick={() => setSpareOpen(true)}>
                <Boxes className="size-4" />
                Spare
              </Button>
              {usableSpare.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setUseOpen(true)}>
                  <Undo2 className="size-4" />
                  Usar spare
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="size-4" />
                Ítem
              </Button>
            </div>
          </div>

          {/* Tabla (escritorio) */}
          <div className="hidden overflow-x-auto md:block">
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
                {filteredNormal.map(renderRow)}
                {filteredSpare.length > 0 && (
                  <>
                    <tr className="bg-primary/5">
                      <td
                        colSpan={8}
                        className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary"
                      >
                        <Boxes className="mr-1.5 inline size-3.5" />
                        Spare — repuestos para el cliente
                      </td>
                    </tr>
                    {filteredSpare.map(renderRow)}
                  </>
                )}
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

          {/* Tarjetas (móvil) */}
          <div className="divide-y md:hidden">
            {filteredNormal.map(renderCard)}
            {filteredSpare.length > 0 && (
              <>
                <div className="bg-primary/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Boxes className="mr-1.5 inline size-3.5" />
                  Spare — repuestos
                </div>
                {filteredSpare.map(renderCard)}
              </>
            )}
            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                Sin ítems que coincidan con el filtro.
              </div>
            )}
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

      {/* Diálogo: marcar unidades de un ítem como spare */}
      {spareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSpareOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <Boxes className="size-4 text-primary" />
              <h3 className="font-semibold">Marcar spare</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Elegí el ítem y cuántas unidades quedan como repuesto. Se restan de lo
              instalado y aparecen en la sección Spare (para el cliente).
            </p>
            <label className="text-xs font-medium text-muted-foreground">Ítem</label>
            <select
              value={spareModel}
              onChange={(e) => setSpareModel(e.target.value)}
              className="mb-3 mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Elegí un ítem…</option>
              {spareModels.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.description}
                  {m.product ? ` · ${m.product}` : ""} — {m.qty} disp.
                </option>
              ))}
            </select>
            <label className="text-xs font-medium text-muted-foreground">Cantidad spare</label>
            <input
              type="number"
              min={1}
              value={spareQty}
              onChange={(e) => setSpareQty(e.target.value)}
              placeholder="Ej. 5"
              className="mb-4 mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSpareOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={submitSpare} disabled={!spareModel || !spareQty}>
                Marcar spare
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo: usar un repuesto (spare → instalado) con nota opcional */}
      {useOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setUseOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <Undo2 className="size-4 text-primary" />
              <h3 className="font-semibold">Usar spare</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Toma unidades de un repuesto y las regresa a instalado. Se descuentan de
              la sección Spare. La nota es opcional (para trazabilidad, si aplica).
            </p>
            <label className="text-xs font-medium text-muted-foreground">Repuesto</label>
            <select
              value={useModel}
              onChange={(e) => setUseModel(e.target.value)}
              className="mb-3 mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Elegí un repuesto…</option>
              {usableSpare.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.description}
                  {m.product ? ` · ${m.product}` : ""} — {m.qty} en spare
                </option>
              ))}
            </select>
            <label className="text-xs font-medium text-muted-foreground">Cantidad a usar</label>
            <input
              type="number"
              min={1}
              value={useQty}
              onChange={(e) => setUseQty(e.target.value)}
              placeholder="Ej. 1"
              className="mb-3 mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            />
            <label className="text-xs font-medium text-muted-foreground">
              Nota <span className="font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={useNote}
              onChange={(e) => setUseNote(e.target.value)}
              placeholder="Ej. Reemplazo de switch defectuoso rack A3"
              className="mb-4 mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setUseOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={submitUseSpare} disabled={!useModel || !useQty}>
                Usar spare
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CellField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("truncate", mono && "font-mono")}>{value}</div>
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
