"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";

export type Empleado = {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  division: string;
  talla_casco: string;
  talla_camisa: string;
  talla_pantalon: string;
  talla_botas: string;
};

const EMPTY: Empleado = {
  id: "",
  nombre: "",
  cedula: "",
  cargo: "",
  division: "",
  talla_casco: "",
  talla_camisa: "",
  talla_pantalon: "",
  talla_botas: "",
};

export function EmpleadosBoard({ orgId, initial }: { orgId: string; initial: Empleado[] }) {
  const sb = createClient();
  const [rows, setRows] = useState<Empleado[]>(initial);
  const [editing, setEditing] = useState<Empleado | null>(null);
  const [saving, setSaving] = useState(false);

  const setE = (k: keyof Empleado, v: string) =>
    setEditing((p) => (p ? { ...p, [k]: v } : p));

  async function save() {
    if (!editing) return;
    if (!editing.nombre.trim()) return toast.error("Ponle nombre al colaborador.");
    setSaving(true);
    const payload = {
      nombre: editing.nombre.trim(),
      cedula: editing.cedula.trim() || null,
      cargo: editing.cargo.trim() || null,
      division: editing.division.trim() || null,
      talla_casco: editing.talla_casco.trim() || null,
      talla_camisa: editing.talla_camisa.trim() || null,
      talla_pantalon: editing.talla_pantalon.trim() || null,
      talla_botas: editing.talla_botas.trim() || null,
    };
    if (editing.id) {
      const { error } = await sb.from("hse_empleados").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("No se pudo guardar.");
      setRows((rs) => rs.map((x) => (x.id === editing.id ? { ...editing } : x)));
    } else {
      const { data, error } = await sb
        .from("hse_empleados")
        .insert({ organization_id: orgId, ...payload })
        .select("id")
        .maybeSingle();
      setSaving(false);
      if (error || !data) return toast.error("No se pudo agregar (¿cédula duplicada?).");
      setRows((rs) => [...rs, { ...editing, id: data.id }]);
    }
    setEditing(null);
    toast.success("Guardado.");
  }

  async function remove(e: Empleado) {
    setRows((rs) => rs.filter((x) => x.id !== e.id));
    const { error } = await sb.from("hse_empleados").update({ activo: false }).eq("id", e.id);
    if (error) {
      toast.error("No se pudo quitar.");
      setRows((rs) => [...rs, e]);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          <p className="text-sm text-muted-foreground">
            Colaboradores y sus tallas de EPP.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Sin colaboradores. Agrega el primero.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <p className="font-semibold leading-tight text-[#0f2044]">{e.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {[e.cargo, e.division].filter(Boolean).join(" · ") || "—"}
                </p>
                {e.cedula && <p className="mt-0.5 text-xs text-muted-foreground">CI: {e.cedula}</p>}
                {(e.talla_casco || e.talla_camisa || e.talla_pantalon || e.talla_botas) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Tallas: {[
                      e.talla_casco && `casco ${e.talla_casco}`,
                      e.talla_camisa && `camisa ${e.talla_camisa}`,
                      e.talla_pantalon && `pantalón ${e.talla_pantalon}`,
                      e.talla_botas && `botas ${e.talla_botas}`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditing({ ...e })} className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => remove(e)} className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog.Root open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            <Dialog.Title className="text-base font-semibold">
              {editing?.id ? "Editar colaborador" : "Nuevo colaborador"}
            </Dialog.Title>
            {editing && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Nombre y apellido</Label>
                  <input className={inp} value={editing.nombre} onChange={(e) => setE("nombre", e.target.value)} autoFocus />
                </div>
                <div>
                  <Label>Cédula</Label>
                  <input className={inp} value={editing.cedula} onChange={(e) => setE("cedula", e.target.value)} />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <input className={inp} value={editing.cargo} onChange={(e) => setE("cargo", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>División</Label>
                  <input className={inp} value={editing.division} onChange={(e) => setE("division", e.target.value)} placeholder="Ej. Telecomunicaciones" />
                </div>
                <div>
                  <Label>Talla casco</Label>
                  <input className={inp} value={editing.talla_casco} onChange={(e) => setE("talla_casco", e.target.value)} />
                </div>
                <div>
                  <Label>Talla camisa</Label>
                  <input className={inp} value={editing.talla_camisa} onChange={(e) => setE("talla_camisa", e.target.value)} />
                </div>
                <div>
                  <Label>Talla pantalón</Label>
                  <input className={inp} value={editing.talla_pantalon} onChange={(e) => setE("talla_pantalon", e.target.value)} />
                </div>
                <div>
                  <Label>Talla botas</Label>
                  <input className={inp} value={editing.talla_botas} onChange={(e) => setE("talla_botas", e.target.value)} />
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
