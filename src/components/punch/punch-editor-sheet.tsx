"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type PunchPriority,
  type PunchStatus,
} from "@/lib/punch";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Item = Database["public"]["Tables"]["punch_items"]["Row"];

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";
const areaCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function PunchEditorSheet({
  item,
  project,
  open,
  onOpenChange,
}: {
  item: Item | null;
  project: { id: string; organization_id: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = !!item;
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [priority, setPriority] = useState<PunchPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<PunchStatus>("open");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setDescription(item.description);
      setResponsible(item.responsible ?? "");
      setPriority(item.priority);
      setDueDate(item.due_date ?? "");
      setStatus(item.status);
    } else {
      setDescription("");
      setResponsible("");
      setPriority("medium");
      setDueDate("");
      setStatus("open");
    }
  }, [item, open]);

  async function save() {
    if (!description.trim()) {
      toast.error("Escribe una descripción del pendiente.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const resolved_at =
      status === "done" ? (item?.resolved_at ?? new Date().toISOString()) : null;
    const payload = {
      description: description.trim(),
      responsible: responsible.trim() || null,
      priority,
      due_date: dueDate || null,
      status,
      resolved_at,
    };
    if (isEdit && item) {
      const { error } = await supabase
        .from("punch_items")
        .update(payload)
        .eq("id", item.id);
      if (error) {
        toast.error("No se pudo guardar el pendiente.");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("punch_items").insert({
        organization_id: project.organization_id,
        project_id: project.id,
        ...payload,
      });
      if (error) {
        toast.error("No se pudo crear el pendiente.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!item) return;
    if (!window.confirm("¿Eliminar este pendiente? No se puede deshacer.")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("punch_items")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error("No se pudo eliminar.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "Editar pendiente" : "Nuevo pendiente"}</SheetTitle>
          <SheetDescription>
            Asigna responsable, prioridad y fecha límite.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="pu-desc">Descripción</Label>
            <textarea
              id="pu-desc"
              rows={3}
              className={areaCls}
              placeholder="Ej. Sellar penetraciones de cable en sala MDF"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pu-resp">Responsable</Label>
            <Input
              id="pu-resp"
              placeholder="Nombre del responsable"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pu-prio">Prioridad</Label>
              <select
                id="pu-prio"
                className={fieldCls}
                value={priority}
                onChange={(e) => setPriority(e.target.value as PunchPriority)}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-due">Fecha límite</Label>
              <input
                id="pu-due"
                type="date"
                className={fieldCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pu-status">Estado</Label>
            <select
              id="pu-status"
              className={fieldCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as PunchStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-2 border-t">
          {isEdit ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear pendiente"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
