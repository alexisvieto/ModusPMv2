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
  CATEGORY_OPTIONS,
  LOCATION_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/inventory";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];
type Cat = Database["public"]["Enums"]["inventory_category"];
type Status = Database["public"]["Enums"]["inventory_status"];
type Loc = Database["public"]["Enums"]["inventory_location"];
type TaskOpt = { id: string; wbs: string | null; name: string };

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function InventoryEditorSheet({
  item,
  tasks,
  open,
  onOpenChange,
}: {
  item: Item | null;
  tasks: TaskOpt[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Item | null>(item);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(item), [item]);

  function set<K extends keyof Item>(k: K, v: Item[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("inventory_items")
      .update({
        description: form.description,
        equipment_name: form.equipment_name,
        rack_position: form.rack_position,
        product_number: form.product_number,
        serial_number: form.serial_number,
        barcode: form.barcode,
        brand_model: form.brand_model,
        category: form.category,
        quantity: form.quantity,
        status: form.status,
        location: form.location,
        supplier: form.supplier,
        task_id: form.task_id,
        notes: form.notes,
      })
      .eq("id", form.id);
    if (error) {
      toast.error("No se pudo guardar el ítem.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!form) return;
    if (!window.confirm("¿Eliminar este ítem del inventario? No se puede deshacer."))
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", form.id);
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
        {form && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>Ítem de inventario</SheetTitle>
              <SheetDescription>
                {form.serial_number ? `Serial ${form.serial_number}` : "Equipo / material"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-1.5">
                <Label htmlFor="i-desc">Descripción</Label>
                <Input
                  id="i-desc"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="i-name">Nombre / Hostname</Label>
                  <Input
                    id="i-name"
                    placeholder="Ej. MIANAP-SRV19"
                    value={form.equipment_name ?? ""}
                    onChange={(e) => set("equipment_name", e.target.value || null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="i-rack">Ubicación en rack</Label>
                  <Input
                    id="i-rack"
                    placeholder="Ej. SEC 0205/F 20U"
                    value={form.rack_position ?? ""}
                    onChange={(e) => set("rack_position", e.target.value || null)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="i-barcode">Código de barras</Label>
                <Input
                  id="i-barcode"
                  value={form.barcode ?? ""}
                  onChange={(e) => set("barcode", e.target.value || null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="i-pn">N° de producto</Label>
                  <Input
                    id="i-pn"
                    value={form.product_number ?? ""}
                    onChange={(e) => set("product_number", e.target.value || null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="i-serial">Serial</Label>
                  <Input
                    id="i-serial"
                    value={form.serial_number ?? ""}
                    onChange={(e) => set("serial_number", e.target.value || null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="i-brand">Marca / Modelo</Label>
                  <Input
                    id="i-brand"
                    value={form.brand_model ?? ""}
                    onChange={(e) => set("brand_model", e.target.value || null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="i-cat">Categoría</Label>
                  <select
                    id="i-cat"
                    className={fieldCls}
                    value={form.category}
                    onChange={(e) => set("category", e.target.value as Cat)}
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="i-qty">Cantidad</Label>
                  <input
                    id="i-qty"
                    type="number"
                    min={0}
                    className={fieldCls}
                    value={Number(form.quantity)}
                    onChange={(e) => set("quantity", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="i-status">Estado</Label>
                  <select
                    id="i-status"
                    className={fieldCls}
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as Status)}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="i-loc">Ubicación</Label>
                  <select
                    id="i-loc"
                    className={fieldCls}
                    value={form.location}
                    onChange={(e) => set("location", e.target.value as Loc)}
                  >
                    {LOCATION_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="i-sup">Proveedor</Label>
                <Input
                  id="i-sup"
                  value={form.supplier ?? ""}
                  onChange={(e) => set("supplier", e.target.value || null)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="i-task">Tarea vinculada (Gantt)</Label>
                <select
                  id="i-task"
                  className={fieldCls}
                  value={form.task_id ?? ""}
                  onChange={(e) => set("task_id", e.target.value || null)}
                >
                  <option value="">Sin vincular</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.wbs ? `${t.wbs} · ` : ""}
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="i-notes">Notas</Label>
                <textarea
                  id="i-notes"
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                />
              </div>
            </div>

            <SheetFooter className="flex-row justify-between border-t">
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={remove}
              >
                <Trash2 className="size-4" />
                Eliminar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
