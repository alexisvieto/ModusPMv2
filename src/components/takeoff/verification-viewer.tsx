"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  MousePointerClick,
  Plus,
  RotateCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { elementsFor, type ElementDef } from "@/lib/takeoff/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Sheet = Database["public"]["Tables"]["takeoff_sheets"]["Row"];
type Detection = {
  id: string;
  sheet_id: string;
  element_key: string;
  x: number;
  y: number;
  confidence: string;
  method: string | null;
  status: string;
  original_key: string | null;
};
type Project = { id: string; organization_id: string; name: string };

const ACTIVE_STATUSES = ["detectado", "confirmado", "reclasificado", "agregado_manual"];

// Fila del diccionario de leyenda (símbolo → tipo del catálogo).
type LegendRow = { symbol: string; element_key: string; name: string };

function parseLegend(j: unknown): LegendRow[] {
  if (!Array.isArray(j)) return [];
  return j.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      symbol: String(o.symbol ?? ""),
      element_key: String(o.element_key ?? "otro"),
      name: String(o.name ?? ""),
    };
  });
}

export function VerificationViewer({
  project,
  analysis,
  system,
  sheets: initialSheets,
  detections: initialDetections,
  imgUrls,
  currentUserId,
}: {
  project: Project;
  analysis: { id: string; name: string; status: string; system_type: string };
  system: { id: string; display_name: string; system_type: string; legend?: unknown };
  sheets: Sheet[];
  detections: Detection[];
  imgUrls: Record<string, string>;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const elements = useMemo(() => elementsFor(analysis.system_type), [analysis.system_type]);
  const elByKey = useMemo(
    () => new Map(elements.map((e) => [e.key, e])),
    [elements],
  );

  const [sheets, setSheets] = useState(initialSheets);
  const [dets, setDets] = useState<Detection[]>(initialDetections);
  const [activeSheetId, setActiveSheetId] = useState(initialSheets[0]?.id ?? "");

  // Resync props→estado tras router.refresh() (el procesamiento de hojas trae
  // detecciones nuevas del server). Patrón de ajuste en render con guard.
  const [prevDets, setPrevDets] = useState(initialDetections);
  if (prevDets !== initialDetections) {
    setPrevDets(initialDetections);
    setDets(initialDetections);
  }
  const [prevSheets, setPrevSheets] = useState(initialSheets);
  if (prevSheets !== initialSheets) {
    setPrevSheets(initialSheets);
    setSheets(initialSheets);
  }
  const [processing, setProcessing] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  // Herramientas del panel
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [onlyDudosos, setOnlyDudosos] = useState(false);
  const [addKey, setAddKey] = useState<string | null>(null); // tipo activo para agregar

  // Zoom/pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const sheetDets = useMemo(
    () => dets.filter((d) => d.sheet_id === activeSheetId && ACTIVE_STATUSES.includes(d.status)),
    [dets, activeSheetId],
  );

  // Contadores por tipo (en vivo)
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of sheetDets) m.set(d.element_key, (m.get(d.element_key) ?? 0) + 1);
    return m;
  }, [sheetDets]);
  const dudososCount = sheetDets.filter((d) => d.confidence !== "alta").length;

  // ── Diccionario de leyenda (checkpoint humano previo al conteo definitivo) ──
  // Editable; al recontar, el motor vuelve a contar con la leyenda confirmada.
  // Si la hoja no trae leyenda propia (solo la 1ª hoja del juego la tiene), se
  // usa el diccionario del SISTEMA como respaldo.
  const seedLegend = useCallback(
    (sheet: Sheet | null) => {
      const own = parseLegend(sheet?.legend);
      return own.length ? own : parseLegend(system.legend);
    },
    [system.legend],
  );
  const [legendRows, setLegendRows] = useState<LegendRow[]>(() =>
    seedLegend(activeSheet),
  );
  const [prevLegendSheet, setPrevLegendSheet] = useState(activeSheetId);
  if (prevLegendSheet !== activeSheetId) {
    setPrevLegendSheet(activeSheetId);
    setLegendRows(seedLegend(activeSheet));
  }
  const [showLegend, setShowLegend] = useState(true);
  const [recounting, setRecounting] = useState(false);

  function updateLegendRow(i: number, patch: Partial<LegendRow>) {
    setLegendRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function removeLegendRow(i: number) {
    setLegendRows((rows) => rows.filter((_, j) => j !== i));
  }
  function addLegendRow() {
    setLegendRows((rows) => [
      ...rows,
      { symbol: "", element_key: elements[0]?.key ?? "otro", name: "" },
    ]);
  }

  async function recount() {
    if (!activeSheet) return;
    setRecounting(true);
    try {
      const res = await fetch("/api/takeoff/sheet-recount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: activeSheet.id,
          symbols: legendRows.filter((r) => r.symbol.trim()),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error ?? "No se pudo recontar.");
        return;
      }
      toast.success("Reconteo aplicado con la leyenda confirmada.");
      router.refresh();
    } catch {
      toast.error("Error de red al recontar.");
    } finally {
      setRecounting(false);
    }
  }

  const visibleDets = useMemo(
    () =>
      sheetDets.filter((d) => {
        if (filterKey && d.element_key !== filterKey) return false;
        if (onlyDudosos && d.confidence === "alta") return false;
        return true;
      }),
    [sheetDets, filterKey, onlyDudosos],
  );

  // ── Procesar hojas pendientes al entrar (una por una) ──
  const runPending = useCallback(async () => {
    const pending = sheets.filter((s) => s.status === "pendiente" || s.status === "error");
    for (const s of pending) {
      setProcessing(s.sheet_number);
      try {
        const res = await fetch("/api/takeoff/sheet-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetId: s.id }),
        });
        if (!res.ok) {
          const j = await res.json();
          toast.error(`${s.sheet_number}: ${j.error ?? "falló"}`);
        }
      } catch {
        toast.error(`${s.sheet_number}: error de red`);
      }
    }
    setProcessing(null);
    if (pending.length) router.refresh();
  }, [sheets, router]);

  const startedRef = useRef(false);
  useEffect(() => {
    // Al montar, procesa las hojas pendientes una sola vez. queueMicrotask
    // saca el disparo del render síncrono del efecto.
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialSheets.some((s) => s.status === "pendiente")) {
      queueMicrotask(() => void runPending());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Acciones sobre detecciones ──
  async function patchDet(id: string, patch: Partial<Detection>) {
    setDets((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    const supabase = createClient();
    await supabase
      .from("takeoff_detections")
      .update({ ...patch, reviewed_by: currentUserId, reviewed_at: new Date().toISOString() })
      .eq("id", id);
  }

  const [selectedDet, setSelectedDet] = useState<string | null>(null);

  async function confirmDet(d: Detection) {
    await patchDet(d.id, { status: "confirmado", confidence: "alta" });
    setSelectedDet(null);
  }
  async function removeDet(d: Detection) {
    await patchDet(d.id, { status: "eliminado" });
    setSelectedDet(null);
  }
  async function reclassDet(d: Detection, key: string) {
    await patchDet(d.id, {
      status: "reclasificado",
      element_key: key,
      original_key: d.original_key ?? d.element_key,
      confidence: "alta",
    });
    setSelectedDet(null);
  }

  // ── Agregar detección al hacer clic en el plano ──
  async function addAt(nx: number, ny: number) {
    if (!addKey || !activeSheet) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("takeoff_detections")
      .insert({
        organization_id: project.organization_id,
        sheet_id: activeSheet.id,
        element_key: addKey,
        x: nx,
        y: ny,
        confidence: "alta",
        method: "manual",
        status: "agregado_manual",
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
      })
      .select("id, sheet_id, element_key, x, y, confidence, method, status, original_key")
      .maybeSingle();
    if (error || !data) {
      toast.error("No se pudo agregar el elemento.");
      return;
    }
    setDets((prev) => [...prev, data]);
  }

  // ── Aprobar el análisis: consolida resultados, snapshot, borra PDFs ──
  async function approveAnalysis() {
    setApproving(true);
    try {
      const res = await fetch("/api/takeoff/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: analysis.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo aprobar.");
        return;
      }
      toast.success("Análisis aprobado. Cantidades listas para costos.");
      router.push(`/app/proyectos/${project.id}/calculo/sistema/${system.id}`);
    } finally {
      setApproving(false);
    }
  }

  // Zoom/pan handlers
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.min(6, Math.max(0.5, z - e.deltaY * 0.0015)));
  }
  function onPointerDown(e: React.PointerEvent) {
    if (addKey) return; // en modo agregar el clic coloca, no arrastra
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (!addKey || !canvasRef.current) return;
    const img = canvasRef.current.querySelector("img");
    if (!img) return;
    const r = img.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
    void addAt(nx, ny);
  }

  const allReady =
    sheets.length > 0 &&
    sheets.every((s) => s.status === "en_verificacion" || s.status === "aprobada");
  const isApproved = analysis.status === "aprobado";

  const imgUrl = activeSheet ? imgUrls[activeSheet.id] : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href={`/app/proyectos/${project.id}/calculo/sistema/${system.id}`}
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "-ml-2")}
          >
            <ArrowLeft className="size-4" />
            {system.display_name}
          </Link>
          <div>
            <p className="text-sm font-semibold">{analysis.name}</p>
            <p className="text-xs text-muted-foreground">
              {sheets.length} {sheets.length === 1 ? "hoja" : "hojas"} · verifica y
              aprueba
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {processing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Procesando {processing}…
            </span>
          )}
          {!isApproved && (
            <Button size="sm" onClick={approveAnalysis} disabled={!allReady || approving}>
              {approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Aprobar análisis
            </Button>
          )}
          {isApproved && (
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              Aprobado
            </span>
          )}
        </div>
      </div>

      {/* Selector de hojas */}
      {sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b px-4 py-1.5">
          {sheets.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSheetId(s.id);
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                s.id === activeSheetId
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s.sheet_number}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden bg-neutral-900",
            addKey ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
          )}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={onCanvasClick}
        >
          {imgUrl ? (
            <div
              className="absolute left-1/2 top-1/2 origin-center"
              style={{
                transform: `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt={activeSheet?.sheet_number ?? ""}
                className="max-h-[80vh] w-auto select-none"
                draggable={false}
              />
              {/* Overlay de marcadores */}
              {visibleDets.map((d) => {
                const el = elByKey.get(d.element_key);
                const sel = selectedDet === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDet(sel ? null : d.id);
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
                  >
                    <span
                      className={cn(
                        "block rounded-full ring-2",
                        d.confidence === "alta" ? "ring-solid" : "ring-dashed",
                      )}
                      style={{
                        width: sel ? 18 : 12,
                        height: sel ? 18 : 12,
                        background: (el?.color ?? "#6B7280") + "cc",
                        borderColor: el?.color ?? "#6B7280",
                        // borde punteado para confianza no-alta
                        boxShadow: sel ? "0 0 0 3px rgba(255,255,255,.6)" : "none",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/60">
              {processing ? "Procesando planos…" : "Sin imagen de plano para esta hoja."}
            </div>
          )}

          {/* Menú de detección seleccionada */}
          {selectedDet &&
            (() => {
              const d = sheetDets.find((x) => x.id === selectedDet);
              if (!d) return null;
              return (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-lg border bg-background/95 p-1.5 shadow-lg backdrop-blur">
                  <Button size="sm" variant="ghost" onClick={() => confirmDet(d)}>
                    <Check className="size-4 text-success" /> Confirmar
                  </Button>
                  <select
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                    value=""
                    onChange={(e) => e.target.value && reclassDet(d, e.target.value)}
                  >
                    <option value="">Reclasificar…</option>
                    {elements.map((el) => (
                      <option key={el.key} value={el.key}>
                        {el.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => removeDet(d)}>
                    <Trash2 className="size-4 text-destructive" /> Eliminar
                  </Button>
                </div>
              );
            })()}

          {/* Controles de zoom */}
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border bg-background/90 text-sm shadow">
            <button className="px-2.5 py-1 hover:bg-muted" onClick={() => setZoom((z) => Math.min(6, z + 0.3))}>
              +
            </button>
            <button className="border-t px-2.5 py-1 hover:bg-muted" onClick={() => setZoom((z) => Math.max(0.5, z - 0.3))}>
              −
            </button>
            <button
              className="border-t px-2.5 py-1 text-xs hover:bg-muted"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l">
          {/* Aviso: la leyenda no se pudo leer (se contó con el mapeo estándar).
              Nunca se degrada en silencio. */}
          {activeSheet?.job_error && !isApproved && (
            <div className="flex items-start gap-2 border-b bg-warning/10 p-3 text-xs text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{activeSheet.job_error}</span>
            </div>
          )}
          {/* Diccionario de leyenda: checkpoint humano. Revisar/corregir el
              mapeo símbolo→tipo y recontar antes de verificar los marcadores. */}
          {!isApproved && activeSheet && legendRows.length > 0 && (
            <div className="border-b">
              <button
                onClick={() => setShowLegend((v) => !v)}
                className="flex w-full items-center justify-between p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <span>Leyenda ({legendRows.length})</span>
                <ChevronDown
                  className={cn("size-4 transition-transform", showLegend ? "" : "-rotate-90")}
                />
              </button>
              {showLegend && (
                <div className="space-y-2 px-3 pb-3">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Confirmá que cada símbolo esté en su tipo. Si corregís algo,
                    pulsá <span className="font-medium">Recontar</span>.
                  </p>
                  <div className="space-y-1.5">
                    {legendRows.map((row, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          value={row.symbol}
                          onChange={(e) => updateLegendRow(i, { symbol: e.target.value })}
                          placeholder="símb."
                          className="h-7 w-12 shrink-0 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring"
                        />
                        <select
                          value={row.element_key}
                          onChange={(e) => updateLegendRow(i, { element_key: e.target.value })}
                          className="h-7 min-w-0 flex-1 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring"
                        >
                          {elements.map((el) => (
                            <option key={el.key} value={el.key}>
                              {el.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeLegendRow(i)}
                          title="Quitar fila"
                          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addLegendRow} className="text-xs text-primary hover:underline">
                    + agregar símbolo
                  </button>
                  <Button size="sm" className="w-full" onClick={recount} disabled={recounting}>
                    {recounting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCw className="size-4" />
                    )}
                    Recontar con esta leyenda
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="border-b p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Elementos ({sheetDets.length})
            </p>
            <button
              onClick={() => setOnlyDudosos((v) => !v)}
              className={cn(
                "mt-2 w-full rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors",
                onlyDudosos ? "border-warning bg-warning/10 text-warning" : "hover:bg-muted",
              )}
            >
              Ver solo dudosos ({dudososCount})
            </button>
          </div>

          <div className="flex-1 p-2">
            {elements
              .filter((el) => (counts.get(el.key) ?? 0) > 0 || addKey === el.key)
              .map((el) => {
                const n = counts.get(el.key) ?? 0;
                return (
                  <ElementRow
                    key={el.key}
                    el={el}
                    n={n}
                    filtered={filterKey === el.key}
                    adding={addKey === el.key}
                    onFilter={() => setFilterKey((k) => (k === el.key ? null : el.key))}
                    onAdd={() => setAddKey((k) => (k === el.key ? null : el.key))}
                  />
                );
              })}
            {sheetDets.length === 0 && !processing && (
              <p className="p-3 text-xs text-muted-foreground">
                Sin detecciones en esta hoja. Usa “Agregar” en un tipo para
                marcar elementos manualmente.
              </p>
            )}
          </div>

          {addKey && (
            <div className="border-t bg-primary/5 p-3 text-xs text-primary">
              <MousePointerClick className="mr-1 inline size-3.5" />
              Modo agregar: clic en el plano para colocar{" "}
              <span className="font-medium">{elByKey.get(addKey)?.name}</span>.
              <button className="ml-1 underline" onClick={() => setAddKey(null)}>
                salir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ElementRow({
  el,
  n,
  filtered,
  adding,
  onFilter,
  onAdd,
}: {
  el: ElementDef;
  n: number;
  filtered: boolean;
  adding: boolean;
  onFilter: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5",
        filtered ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <span className="size-3 shrink-0 rounded-full" style={{ background: el.color }} />
      <button onClick={onFilter} className="min-w-0 flex-1 text-left text-sm">
        <span className="truncate">{el.name}</span>
      </button>
      <span className="tabular-nums text-sm font-medium">{n}</span>
      <button
        onClick={onAdd}
        title="Agregar manualmente"
        className={cn(
          "rounded p-0.5 transition-colors",
          adding ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
