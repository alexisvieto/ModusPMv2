"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PunchEditorSheet } from "@/components/punch/punch-editor-sheet";
import {
  dueLabel,
  dueState,
  PRIORITY_META,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type PunchStatus,
} from "@/lib/punch";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Item = Database["public"]["Tables"]["punch_items"]["Row"];
type Project = { id: string; organization_id: string; name: string };

const selectCls =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring";

export function PunchBoard({
  project,
  initialItems,
}: {
  project: Project;
  initialItems: Item[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [prio, setPrio] = useState("");
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  // Hidratación: dueState depende del reloj; solo en cliente tras montar.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  // Resincroniza con los datos del servidor tras un refresh (ajuste en render).
  const [syncedItems, setSyncedItems] = useState(initialItems);
  if (syncedItems !== initialItems) {
    setSyncedItems(initialItems);
    setItems(initialItems);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`punch-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "punch_items",
          filter: `project_id=eq.${project.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, router]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (prio && i.priority !== prio) return false;
        if (status && i.status !== status) return false;
        return true;
      }),
    [items, prio, status],
  );

  async function setItemStatus(id: string, newStatus: PunchStatus) {
    const prev = items;
    const resolved_at =
      newStatus === "done" ? new Date().toISOString() : null;
    setItems((p) =>
      p.map((i) => (i.id === id ? { ...i, status: newStatus, resolved_at } : i)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("punch_items")
      .update({ status: newStatus, resolved_at })
      .eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("No se pudo actualizar el estado.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectCls}
            value={prio}
            onChange={(e) => setPrio(e.target.value)}
          >
            <option value="">Prioridad</option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Estado</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {filtered.length} de {items.length}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Agregar pendiente
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Responsable</th>
                  <th className="px-3 py-2 font-medium">Prioridad</th>
                  <th className="px-3 py-2 font-medium">Vence</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const ds = mounted ? dueState(i) : "ok";
                  const pm = PRIORITY_META[i.priority];
                  return (
                    <tr
                      key={i.id}
                      onClick={() => {
                        setEditing(i);
                        setOpen(true);
                      }}
                      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="max-w-[280px] px-3 py-2">
                        <span className="line-clamp-2">{i.description || "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {i.responsible || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            pm.className,
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", pm.dot)} />
                          {pm.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {i.due_date ? (
                          <div className="flex flex-col">
                            <span className="tabular-nums">
                              {formatDate(i.due_date)}
                            </span>
                            {mounted && (ds === "overdue" || ds === "soon") && (
                              <span
                                className={cn(
                                  "text-xs",
                                  ds === "overdue"
                                    ? "font-medium text-destructive"
                                    : "text-warning",
                                )}
                              >
                                {dueLabel(i.due_date)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          className={cn(selectCls, "h-7")}
                          value={i.status}
                          onChange={(e) =>
                            setItemStatus(i.id, e.target.value as PunchStatus)
                          }
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-12 text-center text-muted-foreground"
                    >
                      Sin pendientes. Agrega uno con “+ Agregar pendiente”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tarjetas (móvil) */}
          <div className="divide-y md:hidden">
            {filtered.map((i) => {
              const ds = mounted ? dueState(i) : "ok";
              const pm = PRIORITY_META[i.priority];
              return (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setEditing(i);
                    setOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === " ") &&
                      e.target === e.currentTarget
                    ) {
                      e.preventDefault();
                      setEditing(i);
                      setOpen(true);
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none active:bg-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 text-sm font-medium">
                      {i.description || "—"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        pm.className,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", pm.dot)} />
                      {pm.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{i.responsible || "Sin responsable"}</span>
                    {i.due_date && (
                      <span
                        className={cn(
                          "tabular-nums",
                          mounted && ds === "overdue" && "font-medium text-destructive",
                          mounted && ds === "soon" && "text-warning",
                        )}
                      >
                        Vence {formatDate(i.due_date)}
                        {mounted && (ds === "overdue" || ds === "soon")
                          ? ` · ${dueLabel(i.due_date)}`
                          : ""}
                      </span>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      className={cn(selectCls, "h-8 w-full")}
                      value={i.status}
                      onChange={(e) =>
                        setItemStatus(i.id, e.target.value as PunchStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                Sin pendientes. Agrega uno con “+ Agregar pendiente”.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PunchEditorSheet
        item={editing}
        project={{ id: project.id, organization_id: project.organization_id }}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
