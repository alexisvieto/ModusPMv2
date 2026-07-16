"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  countResults,
  deriveStatus,
  RESULT_OPTIONS,
  resultButtonClass,
  STATUS_META,
  type FatsatResult,
} from "@/lib/fatsat";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { FatsatEditorSheet } from "@/components/fatsat/fatsat-editor-sheet";
import type { FatsatPdfData } from "@/components/fatsat/fatsat-pdf-document";
import type { Brand } from "@/lib/brand";

const FatsatPdfButton = dynamic(
  () => import("@/components/fatsat/fatsat-pdf-button"),
  { ssr: false },
);

type Protocol = Database["public"]["Tables"]["fatsat_protocols"]["Row"];
type Item = Database["public"]["Tables"]["fatsat_points"]["Row"];
type Prueba = Protocol & { fatsat_points: Item[] };
type Project = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  client_name: string | null;
};

type Filter = "all" | FatsatResult;

export function FatsatBoard({
  project,
  initialPruebas,
  brand,
  sources,
}: {
  project: Project;
  initialPruebas: Prueba[];
  brand: Brand;
  sources: { id: string; name: string; count: number }[];
}) {
  const router = useRouter();
  const [pruebas, setPruebas] = useState<Prueba[]>(initialPruebas);
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Protocol | null>(null);
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState("");
  const [cloning, setCloning] = useState(false);

  async function cloneFrom() {
    if (!cloneSource) return;
    setCloning(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("fatsat_clone_protocols", {
      p_source: cloneSource,
      p_target: project.id,
    });
    setCloning(false);
    if (error) {
      toast.error("No se pudieron clonar las pruebas.");
      return;
    }
    toast.success(`${data ?? 0} prueba(s) clonada(s).`);
    setCloneOpen(false);
    setCloneSource("");
    router.refresh();
  }

  // Resync con los datos del servidor tras crear/editar/eliminar (ajuste de
  // estado en render — patrón recomendado por React, sin efecto).
  const [syncedPruebas, setSyncedPruebas] = useState(initialPruebas);
  if (syncedPruebas !== initialPruebas) {
    setSyncedPruebas(initialPruebas);
    setPruebas(initialPruebas);
  }

  // Realtime sobre la cabecera (las pruebas relacionadas se editan en línea).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`fatsat-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fatsat_protocols",
          filter: `project_id=eq.${project.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, router]);

  const counts = useMemo(
    () => countResults(pruebas.flatMap((p) => p.fatsat_points)),
    [pruebas],
  );

  const chips: { k: Filter; label: string; n: number }[] = [
    { k: "all", label: "Todos", n: counts.total },
    { k: "pending", label: "Pendientes", n: counts.pending },
    { k: "fail", label: "Fallidos", n: counts.fail },
    { k: "pass", label: "Aprobados", n: counts.pass },
    { k: "na", label: "N/A", n: counts.na },
  ];

  function patchItem(pid: string, itemId: string, patch: Partial<Item>) {
    setPruebas((prev) =>
      prev.map((p) =>
        p.id === pid
          ? {
              ...p,
              fatsat_points: p.fatsat_points.map((it) =>
                it.id === itemId ? { ...it, ...patch } : it,
              ),
            }
          : p,
      ),
    );
  }

  async function persistItem(
    itemId: string,
    patch: Partial<Item>,
    onError?: () => void,
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("fatsat_points")
      .update(patch)
      .eq("id", itemId);
    if (error) {
      toast.error("No se pudo guardar el cambio.");
      onError?.();
    }
  }

  function setResult(pid: string, itemId: string, result: FatsatResult) {
    const prev = pruebas
      .find((p) => p.id === pid)
      ?.fatsat_points.find((i) => i.id === itemId)?.result;
    patchItem(pid, itemId, { result });
    void persistItem(itemId, { result }, () => {
      if (prev) patchItem(pid, itemId, { result: prev });
    });
  }

  async function addItem(pid: string) {
    const desc = (newItem[pid] ?? "").trim();
    if (!desc) return;
    const prueba = pruebas.find((p) => p.id === pid);
    if (!prueba) return;
    const nextOrder =
      Math.max(0, ...prueba.fatsat_points.map((i) => i.sort_order)) + 1;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fatsat_points")
      .insert({
        organization_id: prueba.organization_id,
        protocol_id: pid,
        sort_order: nextOrder,
        description: desc,
        result: "pending",
      })
      .select()
      .maybeSingle();
    if (error || !data) {
      toast.error("No se pudo agregar la prueba.");
      return;
    }
    setPruebas((prev) =>
      prev.map((p) =>
        p.id === pid ? { ...p, fatsat_points: [...p.fatsat_points, data] } : p,
      ),
    );
    setNewItem((m) => ({ ...m, [pid]: "" }));
  }

  async function deleteItem(pid: string, itemId: string) {
    const snapshot = pruebas;
    setPruebas((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, fatsat_points: p.fatsat_points.filter((i) => i.id !== itemId) }
          : p,
      ),
    );
    const supabase = createClient();
    const { error } = await supabase.from("fatsat_points").delete().eq("id", itemId);
    if (error) {
      setPruebas(snapshot);
      toast.error("No se pudo eliminar la prueba.");
    }
  }

  async function deletePrueba(pid: string) {
    if (!window.confirm("¿Eliminar esta prueba en campo y todas sus pruebas?"))
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("fatsat_protocols")
      .delete()
      .eq("id", pid);
    if (error) {
      toast.error("No se pudo eliminar.");
      return;
    }
    router.refresh();
  }

  function pdfFor(p: Prueba): FatsatPdfData {
    return {
      brand,
      project: {
        name: project.name,
        code: project.code,
        client_name: project.client_name,
      },
      prueba: {
        name: p.name,
        protocol_date: p.protocol_date,
        status: deriveStatus(p.fatsat_points),
        notes: p.notes,
        executed_by_name: p.executed_by_name,
        executed_by_role: p.executed_by_role,
        executed_at: p.executed_at,
        witness_by_name: p.witness_by_name,
        witness_by_role: p.witness_by_role,
        witness_at: p.witness_at,
        approved_by_name: p.approved_by_name,
        approved_by_role: p.approved_by_role,
        approved_at: p.approved_at,
      },
      items: p.fatsat_points
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          description: i.description,
          result: i.result,
          notes: i.notes,
        })),
    };
  }

  return (
    <>
      {/* Barra: filtros + agregar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.k}
              onClick={() => setFilter(c.k)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === c.k
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {c.label} ({c.n})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {sources.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setCloneOpen(true)}>
              <Copy className="size-4" />
              Clonar de…
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Secciones */}
      <div className="space-y-4">
        {pruebas.map((p) => {
          const items = p.fatsat_points
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order);
          const visible =
            filter === "all" ? items : items.filter((i) => i.result === filter);
          if (filter !== "all" && visible.length === 0) return null;
          const c = countResults(items);
          const st = STATUS_META[deriveStatus(items)];
          return (
            <section key={p.id} className="overflow-hidden rounded-xl border bg-card">
              <header className="flex items-start justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">
                      {p.name ?? "Prueba en campo"}
                    </h3>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs font-medium">
                      <span className={cn("size-1.5 rounded-full", st.dot)} />
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-primary-foreground/80">
                    {formatDate(p.protocol_date)} · {c.pass}/{c.total} aprobados
                    {c.fail > 0 ? ` · ${c.fail} fallidos` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <FatsatPdfButton
                    data={pdfFor(p)}
                    fileName={`Prueba_${(p.name ?? "campo").replace(/\s+/g, "_")}.pdf`}
                  />
                  <button
                    onClick={() => {
                      setEditing(p);
                      setFormOpen(true);
                    }}
                    title="Editar"
                    className="rounded-md p-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => deletePrueba(p.id)}
                    title="Eliminar"
                    className="rounded-md p-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </header>

              <div className="divide-y">
                {visible.map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <input
                          value={item.description}
                          onChange={(e) =>
                            patchItem(p.id, item.id, { description: e.target.value })
                          }
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (!val) {
                              toast.error("La descripción no puede quedar vacía.");
                              router.refresh();
                              return;
                            }
                            persistItem(item.id, { description: val });
                          }}
                          className="w-full rounded bg-transparent text-sm font-medium outline-none focus-visible:bg-muted/40 focus-visible:px-1"
                        />
                        <input
                          value={item.notes ?? ""}
                          placeholder="Observación (opcional)…"
                          onChange={(e) =>
                            patchItem(p.id, item.id, {
                              notes: e.target.value || null,
                            })
                          }
                          onBlur={(e) =>
                            persistItem(item.id, { notes: e.target.value || null })
                          }
                          className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring"
                        />
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {RESULT_OPTIONS.map((o) => (
                          <button
                            key={o.v}
                            onClick={() => setResult(p.id, item.id, o.v)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                              resultButtonClass(o.v, item.result === o.v),
                            )}
                          >
                            {o.v === "pass" && <Check className="size-3" />}
                            {o.v === "fail" && <X className="size-3" />}
                            {o.l}
                          </button>
                        ))}
                        <button
                          onClick={() => deleteItem(p.id, item.id)}
                          title="Quitar"
                          className="ml-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Agregar prueba relacionada */}
                <div className="px-4 py-2.5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addItem(p.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      value={newItem[p.id] ?? ""}
                      onChange={(e) =>
                        setNewItem((m) => ({ ...m, [p.id]: e.target.value }))
                      }
                      placeholder="Agregar prueba relacionada…"
                      className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                    />
                    <Button type="submit" size="sm" variant="outline">
                      Agregar
                    </Button>
                  </form>
                </div>
              </div>

              {(p.executed_by_name || p.witness_by_name || p.approved_by_name) && (
                <footer className="flex flex-wrap gap-x-6 gap-y-1 border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
                  {p.executed_by_name && <span>Ejecutó: {p.executed_by_name}</span>}
                  {p.witness_by_name && <span>Testigo: {p.witness_by_name}</span>}
                  {p.approved_by_name && <span>Aprobó: {p.approved_by_name}</span>}
                </footer>
              )}
            </section>
          );
        })}

        {pruebas.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-sm text-muted-foreground">
            Aún no hay pruebas en campo.
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Agregar la primera
            </Button>
          </div>
        )}
      </div>

      <FatsatEditorSheet
        prueba={editing}
        project={{ id: project.id, organization_id: project.organization_id }}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {/* Diálogo: clonar pruebas ATP de otro proyecto de la organización */}
      {cloneOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCloneOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <Copy className="size-4 text-primary" />
              <h3 className="font-semibold">Clonar pruebas de otro proyecto</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Copia los protocolos (con sus puntos) de otro proyecto de la
              organización como plantilla fresca — en borrador y sin resultados.
              No se toca el proyecto de origen.
            </p>
            <label className="text-xs font-medium text-muted-foreground">
              Proyecto de origen
            </label>
            <select
              value={cloneSource}
              onChange={(e) => setCloneSource(e.target.value)}
              className="mb-4 mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Elegí un proyecto…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.count} prueba{s.count === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCloneOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={cloneFrom} disabled={!cloneSource || cloning}>
                {cloning ? "Clonando…" : "Clonar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
