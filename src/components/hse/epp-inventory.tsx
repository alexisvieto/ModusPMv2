"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { PackageOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";

export type EppItem = {
  id: string;
  nombre: string;
  categoria: string;
  marca: string;
  modelo: string;
  descripcion: string;
  stock_actual: string;
  stock_minimo: string;
  vida_util_dias: string;
};

const EMPTY: EppItem = {
  id: "",
  nombre: "",
  categoria: "",
  marca: "",
  modelo: "",
  descripcion: "",
  stock_actual: "0",
  stock_minimo: "5",
  vida_util_dias: "",
};

export function EppInventory({ orgId, initial }: { orgId: string; initial: EppItem[] }) {
  const sb = createClient();
  const [items, setItems] = useState<EppItem[]>(initial);
  const [editing, setEditing] = useState<EppItem | null>(null);
  const [saving, setSaving] = useState(false);

  const setE = (k: keyof EppItem, v: string) =>
    setEditing((p) => (p ? { ...p, [k]: v } : p));

  async function save() {
    if (!editing) return;
    if (!editing.nombre.trim()) return toast.error("Ponle nombre al ítem.");
    setSaving(true);
    const payload = {
      nombre: editing.nombre.trim(),
      categoria: editing.categoria.trim() || null,
      marca: editing.marca.trim() || null,
      modelo: editing.modelo.trim() || null,
      descripcion: editing.descripcion.trim() || null,
      stock_actual: parseInt(editing.stock_actual) || 0,
      stock_minimo: parseInt(editing.stock_minimo) || 0,
      vida_util_dias: editing.vida_util_dias.trim()
        ? parseInt(editing.vida_util_dias)
        : null,
    };
    if (editing.id) {
      const { error } = await sb.from("hse_epp_items").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("No se pudo guardar.");
      setItems((is) => is.map((x) => (x.id === editing.id ? { ...editing } : x)));
    } else {
      const { data, error } = await sb
        .from("hse_epp_items")
        .insert({ organization_id: orgId, ...payload })
        .select("id")
        .maybeSingle();
      setSaving(false);
      if (error || !data) return toast.error("No se pudo agregar (¿ya existe?).");
      setItems((is) => [...is, { ...editing, id: data.id }]);
    }
    setEditing(null);
    toast.success("Guardado.");
  }

  async function remove(it: EppItem) {
    setItems((is) => is.filter((x) => x.id !== it.id));
    const { error } = await sb.from("hse_epp_items").update({ activo: false }).eq("id", it.id);
    if (error) {
      toast.error("No se pudo quitar.");
      setItems((is) => [...is, it]);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario EPP</h1>
          <p className="text-sm text-muted-foreground">
            Equipos de protección personal, stock y vida útil.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> Nuevo ítem
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <PackageOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Sin ítems. Agrega el primero.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => {
            const stock = parseInt(it.stock_actual) || 0;
            const min = parseInt(it.stock_minimo) || 0;
            const low = stock <= min;
            return (
              <div key={it.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight text-[#0f2044]">{it.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[it.categoria, it.marca, it.modelo].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing({ ...it })}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => remove(it)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 font-medium " +
                      (low ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")
                    }
                  >
                    Stock: {stock} {low && `(mín. ${min})`}
                  </span>
                  {it.vida_util_dias && (
                    <span className="text-muted-foreground">
                      Vida útil: {it.vida_util_dias} d
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* diálogo crear/editar */}
      <Dialog.Root open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            <Dialog.Title className="text-base font-semibold">
              {editing?.id ? "Editar ítem" : "Nuevo ítem EPP"}
            </Dialog.Title>
            {editing && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Nombre</Label>
                  <input className={inp} value={editing.nombre} onChange={(e) => setE("nombre", e.target.value)} autoFocus />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <input className={inp} value={editing.categoria} onChange={(e) => setE("categoria", e.target.value)} placeholder="Ej. Cabeza" />
                </div>
                <div>
                  <Label>Marca</Label>
                  <input className={inp} value={editing.marca} onChange={(e) => setE("marca", e.target.value)} />
                </div>
                <div>
                  <Label>Modelo</Label>
                  <input className={inp} value={editing.modelo} onChange={(e) => setE("modelo", e.target.value)} />
                </div>
                <div>
                  <Label>Vida útil (días)</Label>
                  <input type="number" inputMode="numeric" className={inp} value={editing.vida_util_dias} onChange={(e) => setE("vida_util_dias", e.target.value)} placeholder="Sin vencimiento" />
                </div>
                <div>
                  <Label>Stock actual</Label>
                  <input type="number" inputMode="numeric" className={inp} value={editing.stock_actual} onChange={(e) => setE("stock_actual", e.target.value)} />
                </div>
                <div>
                  <Label>Stock mínimo</Label>
                  <input type="number" inputMode="numeric" className={inp} value={editing.stock_minimo} onChange={(e) => setE("stock_minimo", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Descripción</Label>
                  <textarea className={inp + " h-auto py-2"} rows={2} value={editing.descripcion} onChange={(e) => setE("descripcion", e.target.value)} />
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs text-muted-foreground">{children}</span>;
}
