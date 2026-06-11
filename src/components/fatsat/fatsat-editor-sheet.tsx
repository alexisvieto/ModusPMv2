"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

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
  RESULT_OPTIONS,
  STATUS_META,
  STATUS_OPTIONS,
  suggestStatus,
  type FatsatResult,
  type FatsatStatus,
  type FatsatType,
} from "@/lib/fatsat";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import type { FatsatPdfData } from "@/components/fatsat/fatsat-pdf-document";

const FatsatPdfButton = dynamic(
  () => import("@/components/fatsat/fatsat-pdf-button"),
  {
    ssr: false,
    loading: () => (
      <span className="text-xs text-muted-foreground">Preparando PDF…</span>
    ),
  },
);

type Protocol = Database["public"]["Tables"]["fatsat_protocols"]["Row"];
type Equipment = {
  id: string;
  description: string;
  brand_model: string | null;
  serial_number: string | null;
};
type Project = { name: string; code: string | null; client_name: string | null };

export type EditablePoint = {
  section: string | null;
  description: string;
  expected_result: string | null;
  actual_result: string | null;
  result: FatsatResult;
  notes: string | null;
};

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";
const areaCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function FatsatEditorSheet({
  protocol,
  initialPoints,
  project,
  equipment,
  open,
  onOpenChange,
}: {
  protocol: Protocol | null;
  initialPoints: EditablePoint[];
  project: Project;
  equipment: Equipment[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Protocol | null>(protocol);
  const [points, setPoints] = useState<EditablePoint[]>(initialPoints);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(protocol);
    setPoints(initialPoints);
  }, [protocol, initialPoints]);

  function set<K extends keyof Protocol>(k: K, v: Protocol[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }
  function setPoint(i: number, patch: Partial<EditablePoint>) {
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  const suggested = suggestStatus(points);

  async function save() {
    if (!form) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("fatsat_protocols")
      .update({
        type: form.type,
        code: form.code,
        equipment_item_id: form.equipment_item_id,
        equipment_name: form.equipment_name,
        tag: form.tag,
        protocol_date: form.protocol_date,
        location: form.location,
        status: form.status,
        notes: form.notes,
        executed_by_name: form.executed_by_name,
        executed_by_role: form.executed_by_role,
        executed_at: form.executed_at,
        witness_by_name: form.witness_by_name,
        witness_by_role: form.witness_by_role,
        witness_at: form.witness_at,
        approved_by_name: form.approved_by_name,
        approved_by_role: form.approved_by_role,
        approved_at: form.approved_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", form.id);
    if (error) {
      toast.error("No se pudo guardar el protocolo.");
      setSaving(false);
      return;
    }

    const { error: delError } = await supabase
      .from("fatsat_points")
      .delete()
      .eq("protocol_id", form.id);
    if (delError) {
      toast.error("No se pudieron actualizar los puntos.");
      setSaving(false);
      return;
    }
    const toInsert = points
      .filter((p) => p.description.trim())
      .map((p, i) => ({
        organization_id: form.organization_id,
        protocol_id: form.id,
        sort_order: i + 1,
        section: p.section,
        description: p.description,
        expected_result: p.expected_result,
        actual_result: p.actual_result,
        result: p.result,
        notes: p.notes,
      }));
    if (toInsert.length) {
      const { error: insError } = await supabase
        .from("fatsat_points")
        .insert(toInsert);
      if (insError) {
        toast.error("No se pudieron guardar los puntos.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!form) return;
    if (!window.confirm("¿Eliminar este protocolo? No se puede deshacer.")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("fatsat_protocols")
      .delete()
      .eq("id", form.id);
    if (error) {
      toast.error("No se pudo eliminar.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  function onEquipmentSelect(id: string) {
    if (!id) {
      set("equipment_item_id", null);
      return;
    }
    const item = equipment.find((e) => e.id === id);
    setForm((f) =>
      f
        ? {
            ...f,
            equipment_item_id: id,
            equipment_name: item ? item.description : f.equipment_name,
          }
        : f,
    );
  }

  const pdfData: FatsatPdfData | null = form
    ? {
        project,
        protocol: {
          type: form.type,
          code: form.code,
          equipment_name: form.equipment_name,
          tag: form.tag,
          protocol_date: form.protocol_date,
          location: form.location,
          status: form.status,
          notes: form.notes,
          executed_by_name: form.executed_by_name,
          executed_by_role: form.executed_by_role,
          executed_at: form.executed_at,
          witness_by_name: form.witness_by_name,
          witness_by_role: form.witness_by_role,
          witness_at: form.witness_at,
          approved_by_name: form.approved_by_name,
          approved_by_role: form.approved_by_role,
          approved_at: form.approved_at,
        },
        points: points.filter((p) => p.description.trim()),
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
        {form && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>
                Protocolo {form.type === "fat" ? "FAT" : "SAT"}
                {form.code ? ` · ${form.code}` : ""}
              </SheetTitle>
              <SheetDescription>
                {form.type === "fat"
                  ? "Pruebas de aceptación en fábrica"
                  : "Pruebas de aceptación en sitio"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Cabecera */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="f-type">Tipo</Label>
                  <select
                    id="f-type"
                    className={fieldCls}
                    value={form.type}
                    onChange={(e) => set("type", e.target.value as FatsatType)}
                  >
                    <option value="fat">FAT — en fábrica</option>
                    <option value="sat">SAT — en sitio</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-code">Código</Label>
                  <Input
                    id="f-code"
                    value={form.code ?? ""}
                    onChange={(e) => set("code", e.target.value || null)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="f-equip-sel">Equipo del inventario (opcional)</Label>
                <select
                  id="f-equip-sel"
                  className={fieldCls}
                  value={form.equipment_item_id ?? ""}
                  onChange={(e) => onEquipmentSelect(e.target.value)}
                >
                  <option value="">— Texto libre —</option>
                  {equipment.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.description}
                      {e.serial_number ? ` · ${e.serial_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="f-equip">Equipo / sistema</Label>
                  <Input
                    id="f-equip"
                    value={form.equipment_name ?? ""}
                    onChange={(e) => set("equipment_name", e.target.value || null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-tag">TAG</Label>
                  <Input
                    id="f-tag"
                    value={form.tag ?? ""}
                    onChange={(e) => set("tag", e.target.value || null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="f-date">Fecha</Label>
                  <input
                    id="f-date"
                    type="date"
                    className={fieldCls}
                    value={form.protocol_date}
                    onChange={(e) => set("protocol_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-loc">Ubicación</Label>
                  <Input
                    id="f-loc"
                    value={form.location ?? ""}
                    onChange={(e) => set("location", e.target.value || null)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="f-status">Estado</Label>
                <select
                  id="f-status"
                  className={fieldCls}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as FatsatStatus)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
                {suggested !== form.status && (
                  <button
                    type="button"
                    onClick={() => set("status", suggested)}
                    className="text-xs text-primary hover:underline"
                  >
                    Sugerido por los puntos: {STATUS_META[suggested].label} — aplicar
                  </button>
                )}
              </div>

              {/* Puntos de prueba */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Puntos de prueba</Label>
                  <button
                    onClick={() =>
                      setPoints((p) => [
                        ...p,
                        {
                          section: null,
                          description: "",
                          expected_result: null,
                          actual_result: null,
                          result: "pending",
                          notes: null,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="size-3.5" /> Punto
                  </button>
                </div>

                {points.map((p, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <input
                        placeholder="Sección"
                        className={cn(fieldCls, "h-8 min-w-0 flex-1")}
                        value={p.section ?? ""}
                        onChange={(e) =>
                          setPoint(i, { section: e.target.value || null })
                        }
                      />
                      <select
                        className={cn(fieldCls, "h-8 w-32 shrink-0")}
                        value={p.result}
                        onChange={(e) =>
                          setPoint(i, { result: e.target.value as FatsatResult })
                        }
                      >
                        {RESULT_OPTIONS.map((o) => (
                          <option key={o.v} value={o.v}>
                            {o.l}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          setPoints((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <input
                      placeholder="Criterio / descripción de la prueba"
                      className={cn(fieldCls, "h-8 w-full")}
                      value={p.description}
                      onChange={(e) => setPoint(i, { description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Resultado esperado"
                        className={cn(fieldCls, "h-8")}
                        value={p.expected_result ?? ""}
                        onChange={(e) =>
                          setPoint(i, { expected_result: e.target.value || null })
                        }
                      />
                      <input
                        placeholder="Resultado real"
                        className={cn(fieldCls, "h-8")}
                        value={p.actual_result ?? ""}
                        onChange={(e) =>
                          setPoint(i, { actual_result: e.target.value || null })
                        }
                      />
                    </div>
                    <input
                      placeholder="Observaciones (opcional)"
                      className={cn(fieldCls, "h-8 w-full")}
                      value={p.notes ?? ""}
                      onChange={(e) => setPoint(i, { notes: e.target.value || null })}
                    />
                  </div>
                ))}
                {points.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sin puntos. Agrega uno con “+ Punto”.
                  </p>
                )}
              </div>

              {/* Observaciones generales */}
              <div className="space-y-1.5">
                <Label htmlFor="f-notes">Observaciones generales</Label>
                <textarea
                  id="f-notes"
                  rows={2}
                  className={areaCls}
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                />
              </div>

              {/* Firmas */}
              <div className="space-y-2 border-t pt-4">
                <Label>Firmas</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SignBlock
                    title="Ejecutó"
                    name={form.executed_by_name}
                    role={form.executed_by_role}
                    date={form.executed_at}
                    onName={(v) => set("executed_by_name", v)}
                    onRole={(v) => set("executed_by_role", v)}
                    onDate={(v) => set("executed_at", v)}
                  />
                  <SignBlock
                    title="Testigo (cliente)"
                    name={form.witness_by_name}
                    role={form.witness_by_role}
                    date={form.witness_at}
                    onName={(v) => set("witness_by_name", v)}
                    onRole={(v) => set("witness_by_role", v)}
                    onDate={(v) => set("witness_at", v)}
                  />
                  <SignBlock
                    title="Aprobó"
                    name={form.approved_by_name}
                    role={form.approved_by_role}
                    date={form.approved_at}
                    onName={(v) => set("approved_by_name", v)}
                    onRole={(v) => set("approved_by_role", v)}
                    onDate={(v) => set("approved_at", v)}
                  />
                </div>
              </div>
            </div>

            <SheetFooter className="flex-row items-center justify-between gap-2 border-t">
              <Button variant="ghost" className="text-destructive" onClick={remove}>
                <Trash2 className="size-4" />
                Eliminar
              </Button>
              <div className="flex items-center gap-2">
                {pdfData && (
                  <FatsatPdfButton
                    data={pdfData}
                    fileName={`${form.type.toUpperCase()}_${form.code ?? form.id.slice(0, 8)}.pdf`}
                  />
                )}
                <Button onClick={save} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SignBlock({
  title,
  name,
  role,
  date,
  onName,
  onRole,
  onDate,
}: {
  title: string;
  name: string | null;
  role: string | null;
  date: string | null;
  onName: (v: string | null) => void;
  onRole: (v: string | null) => void;
  onDate: (v: string | null) => void;
}) {
  const cls =
    "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring";
  return (
    <div className="space-y-1.5 rounded-lg border p-2.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <input
        placeholder="Nombre"
        className={cls}
        value={name ?? ""}
        onChange={(e) => onName(e.target.value || null)}
      />
      <input
        placeholder="Rol / cargo"
        className={cls}
        value={role ?? ""}
        onChange={(e) => onRole(e.target.value || null)}
      />
      <input
        type="date"
        className={cls}
        value={date ?? ""}
        onChange={(e) => onDate(e.target.value || null)}
      />
    </div>
  );
}
