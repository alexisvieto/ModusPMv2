"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { PROJECT_STATUS_OPTIONS, type ProjectStatus } from "@/lib/projects";
import { toISODate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";
const areaCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function ProjectCreateSheet({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Limpia el formulario al abrir (ajuste de estado en render — patrón
  // recomendado por React, sin efecto).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setCode("");
      setClient("");
      setLocation("");
      setStatus("active");
      setStart(toISODate(new Date()));
      setEnd("");
      setBudget("");
      setDescription("");
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Ponle un nombre al proyecto.");
      return;
    }
    if (!orgId) {
      toast.error("No se encontró la organización.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        organization_id: orgId,
        name: name.trim(),
        code: code.trim() || null,
        client_name: client.trim() || null,
        location: location.trim() || null,
        status,
        start_date: start || null,
        end_date: end || null,
        budget: budget ? Number(budget) : 0,
        currency: "USD",
        description: description.trim() || null,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error("No se pudo crear el proyecto.");
      return;
    }
    onOpenChange(false);
    router.push(`/app/proyectos/${data.id}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Nuevo proyecto</SheetTitle>
          <SheetDescription>
            Crea un proyecto en la organización. Podrás agregar cronograma,
            inventario, costos, etc. al entrar.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-name">Nombre del proyecto</Label>
            <Input
              id="pr-name"
              placeholder="Ej. Subestación Eléctrica 230 kV"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-code">Código</Label>
              <Input
                id="pr-code"
                placeholder="SE-230-LS"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-status">Estado</Label>
              <select
                id="pr-status"
                className={fieldCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                {PROJECT_STATUS_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-client">Cliente</Label>
              <Input
                id="pr-client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-loc">Ubicación</Label>
              <Input
                id="pr-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-start">Inicio</Label>
              <input
                id="pr-start"
                type="date"
                className={fieldCls}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-end">Fin estimado</Label>
              <input
                id="pr-end"
                type="date"
                className={fieldCls}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-budget">Presupuesto (USD)</Label>
            <input
              id="pr-budget"
              type="number"
              min={0}
              className={fieldCls}
              placeholder="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-desc">Descripción</Label>
            <textarea
              id="pr-desc"
              rows={3}
              className={areaCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Creando…" : "Crear proyecto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
