"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { setUserDepartments } from "@/app/admin/actions";

export type DivisionsTarget = {
  organizationId: string;
  orgName: string;
  userId: string;
  userName: string;
  departments: { key: string; name: string }[];
  current: string[];
};

export function UserDivisionsSheet({
  open,
  onOpenChange,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: DivisionsTarget | null;
  onSaved: () => void;
}) {
  const [keys, setKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Al cambiar de usuario objetivo, precargar sus divisiones actuales
  // (ajuste de estado en render, patrón del repo; sin efecto).
  const tid = target ? `${target.organizationId}:${target.userId}` : null;
  const [prevId, setPrevId] = useState<string | null>(null);
  if (prevId !== tid) {
    setPrevId(tid);
    setKeys(target?.current ?? []);
    setSaving(false);
  }

  async function save() {
    if (!target) return;
    setSaving(true);
    const res = await setUserDepartments({
      organizationId: target.organizationId,
      userId: target.userId,
      keys,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar.");
      return;
    }
    toast.success("Accesos actualizados.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Accesos por división</SheetTitle>
          <SheetDescription>
            {target ? `${target.userName} · ${target.orgName}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {target && target.departments.length > 0 ? (
            <div className="space-y-2 rounded-md border p-3">
              {target.departments.map((d) => (
                <label
                  key={d.key}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={keys.includes(d.key)}
                    onChange={(e) =>
                      setKeys((prev) =>
                        e.target.checked
                          ? [...prev, d.key]
                          : prev.filter((k) => k !== d.key),
                      )
                    }
                  />
                  {d.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta empresa no tiene divisiones configuradas.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            El dueño y el administrador de la empresa ven todas las divisiones
            aunque no estén marcadas.
          </p>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
