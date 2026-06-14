"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

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
import { toISODate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Protocol = Database["public"]["Tables"]["fatsat_protocols"]["Row"];

type Sig = {
  executed_by_name: string | null;
  executed_by_role: string | null;
  executed_at: string | null;
  witness_by_name: string | null;
  witness_by_role: string | null;
  witness_at: string | null;
  approved_by_name: string | null;
  approved_by_role: string | null;
  approved_at: string | null;
};

const EMPTY_SIG: Sig = {
  executed_by_name: null,
  executed_by_role: null,
  executed_at: null,
  witness_by_name: null,
  witness_by_role: null,
  witness_at: null,
  approved_by_name: null,
  approved_by_role: null,
  approved_at: null,
};

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function FatsatEditorSheet({
  prueba,
  project,
  open,
  onOpenChange,
}: {
  prueba: Protocol | null;
  project: { id: string; organization_id: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = !!prueba;
  const [name, setName] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const [sig, setSig] = useState<Sig>(EMPTY_SIG);
  const [saving, setSaving] = useState(false);

  // Resincroniza el formulario al cambiar la prueba o reabrir (ajuste de estado
  // en render — patrón recomendado por React, sin efecto).
  const [synced, setSynced] = useState({ prueba, open });
  if (synced.prueba !== prueba || synced.open !== open) {
    setSynced({ prueba, open });
    if (prueba) {
      setName(prueba.name ?? "");
      setDate(prueba.protocol_date);
      setNotes(prueba.notes ?? "");
      setSig({
        executed_by_name: prueba.executed_by_name,
        executed_by_role: prueba.executed_by_role,
        executed_at: prueba.executed_at,
        witness_by_name: prueba.witness_by_name,
        witness_by_role: prueba.witness_by_role,
        witness_at: prueba.witness_at,
        approved_by_name: prueba.approved_by_name,
        approved_by_role: prueba.approved_by_role,
        approved_at: prueba.approved_at,
      });
    } else {
      setName("");
      setDate(toISODate(new Date()));
      setNotes("");
      setItems([""]);
      setSig(EMPTY_SIG);
    }
  }

  function sigField(k: keyof Sig, v: string) {
    setSig((s) => ({ ...s, [k]: v || null }));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Ponle un nombre a la prueba en campo.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    if (isEdit && prueba) {
      const { error } = await supabase
        .from("fatsat_protocols")
        .update({
          name: name.trim(),
          protocol_date: date,
          notes: notes || null,
          ...sig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prueba.id);
      if (error) {
        toast.error("No se pudo guardar.");
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("fatsat_protocols")
        .insert({
          organization_id: project.organization_id,
          project_id: project.id,
          name: name.trim(),
          protocol_date: date,
          status: "draft",
          notes: notes || null,
          ...sig,
        })
        .select()
        .maybeSingle();
      if (error || !data) {
        toast.error("No se pudo crear la prueba.");
        setSaving(false);
        return;
      }
      const toInsert = items
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d, i) => ({
          organization_id: project.organization_id,
          protocol_id: data.id,
          sort_order: i + 1,
          description: d,
          result: "pending" as const,
        }));
      if (toInsert.length) {
        const { error: pErr } = await supabase
          .from("fatsat_points")
          .insert(toInsert);
        if (pErr) {
          toast.error("Prueba creada, pero no se guardaron las pruebas relacionadas.");
        }
      }
    }
    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>
            {isEdit ? "Editar prueba en campo" : "Nueva prueba en campo"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Edita el nombre, la fecha y las firmas. Las pruebas relacionadas se gestionan en la lista."
              : "Define la prueba en campo y agrega las pruebas relacionadas."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Prueba en campo</Label>
            <Input
              id="p-name"
              placeholder="Ej. Cableado Estructurado"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-date">Fecha de las pruebas</Label>
            <input
              id="p-date"
              type="date"
              className={fieldCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pruebas relacionadas</Label>
                <button
                  onClick={() => setItems((p) => [...p, ""])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="size-3.5" /> Prueba
                </button>
              </div>
              {items.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <input
                    placeholder="Ej. Certificación de cableado estructurado"
                    className={cn(fieldCls, "min-w-0 flex-1")}
                    value={d}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x, idx) => (idx === i ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      setItems((prev) =>
                        prev.length === 1
                          ? [""]
                          : prev.filter((_, idx) => idx !== i),
                      )
                    }
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Cada prueba arranca en “Pendiente”. Su estado y notas se marcan en
                la lista.
              </p>
            </div>
          )}

          {/* Firmas */}
          <div className="space-y-2 border-t pt-4">
            <Label>Firmas</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <SignBlock
                title="Ejecutó"
                name={sig.executed_by_name}
                role={sig.executed_by_role}
                date={sig.executed_at}
                onName={(v) => sigField("executed_by_name", v)}
                onRole={(v) => sigField("executed_by_role", v)}
                onDate={(v) => sigField("executed_at", v)}
              />
              <SignBlock
                title="Testigo (cliente)"
                name={sig.witness_by_name}
                role={sig.witness_by_role}
                date={sig.witness_at}
                onName={(v) => sigField("witness_by_name", v)}
                onRole={(v) => sigField("witness_by_role", v)}
                onDate={(v) => sigField("witness_at", v)}
              />
              <SignBlock
                title="Aprobó"
                name={sig.approved_by_name}
                role={sig.approved_by_role}
                date={sig.approved_at}
                onName={(v) => sigField("approved_by_name", v)}
                onRole={(v) => sigField("approved_by_role", v)}
                onDate={(v) => sigField("approved_at", v)}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear prueba"}
          </Button>
        </SheetFooter>
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
  onName: (v: string) => void;
  onRole: (v: string) => void;
  onDate: (v: string) => void;
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
        onChange={(e) => onName(e.target.value)}
      />
      <input
        placeholder="Rol / cargo"
        className={cls}
        value={role ?? ""}
        onChange={(e) => onRole(e.target.value)}
      />
      <input
        type="date"
        className={cls}
        value={date ?? ""}
        onChange={(e) => onDate(e.target.value)}
      />
    </div>
  );
}
