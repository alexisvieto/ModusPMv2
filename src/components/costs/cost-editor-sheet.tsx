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
import { COST_CATEGORY_OPTIONS } from "@/lib/costs";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Cost = Database["public"]["Tables"]["cost_entries"]["Row"];
type Cat = Database["public"]["Enums"]["cost_category"];

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function CostEditorSheet({
  cost,
  open,
  onOpenChange,
}: {
  cost: Cost | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Cost | null>(cost);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(cost), [cost]);

  function set<K extends keyof Cost>(k: K, v: Cost[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cost_entries")
      .update({
        cost_code: form.cost_code,
        supplier: form.supplier,
        description: form.description,
        category: form.category,
        budget: form.budget,
        committed: form.committed,
        actual: form.actual,
        entry_date: form.entry_date,
      })
      .eq("id", form.id);
    if (error) {
      toast.error("No se pudo guardar la partida.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!form) return;
    if (!window.confirm("¿Eliminar esta partida de costo? No se puede deshacer."))
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("cost_entries")
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
              <SheetTitle>Partida de costo</SheetTitle>
              <SheetDescription>
                Origen: {form.source ?? "manual"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c-code">Código</Label>
                  <Input
                    id="c-code"
                    value={form.cost_code ?? ""}
                    onChange={(e) => set("cost_code", e.target.value || null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-cat">Categoría</Label>
                  <select
                    id="c-cat"
                    className={fieldCls}
                    value={form.category}
                    onChange={(e) => set("category", e.target.value as Cat)}
                  >
                    {COST_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-desc">Descripción</Label>
                <Input
                  id="c-desc"
                  value={form.description ?? ""}
                  onChange={(e) => set("description", e.target.value || null)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-supplier">Proveedor</Label>
                <Input
                  id="c-supplier"
                  placeholder="Ej. Anixter INC."
                  value={form.supplier ?? ""}
                  onChange={(e) => set("supplier", e.target.value || null)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c-budget">Presupuesto</Label>
                  <input
                    id="c-budget"
                    type="number"
                    min={0}
                    className={fieldCls}
                    value={Number(form.budget)}
                    onChange={(e) => set("budget", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-committed">Comprometido</Label>
                  <input
                    id="c-committed"
                    type="number"
                    min={0}
                    className={fieldCls}
                    value={Number(form.committed)}
                    onChange={(e) => set("committed", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-actual">Costo real</Label>
                  <input
                    id="c-actual"
                    type="number"
                    min={0}
                    className={fieldCls}
                    value={Number(form.actual)}
                    onChange={(e) => set("actual", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-date">Fecha</Label>
                <input
                  id="c-date"
                  type="date"
                  className={fieldCls}
                  value={form.entry_date}
                  onChange={(e) => set("entry_date", e.target.value)}
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
