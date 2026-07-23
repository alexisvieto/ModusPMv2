"use client";

import { useState } from "react";
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
import { updateOrgBilling } from "@/app/admin/actions";

export type BillingTarget = {
  id: string;
  name: string;
  seatLimit: number | null;
  pricePerSeat: number;
  billable: boolean;
  activeSeats: number;
};

export function OrgBillingSheet({
  open,
  onOpenChange,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: BillingTarget | null;
  onSaved: () => void;
}) {
  const [seatLimit, setSeatLimit] = useState("");
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carga los valores del target al abrir (ajuste en render, sin efecto).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open && target) {
      setSeatLimit(target.seatLimit === null ? "" : String(target.seatLimit));
      setPricePerSeat(target.pricePerSeat ? String(target.pricePerSeat) : "");
      setBillable(target.billable);
      setSaving(false);
    }
  }

  async function save() {
    if (!target) return;
    const limit = seatLimit.trim() === "" ? null : Number(seatLimit);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
      toast.error("El tope de asientos debe ser un número (o vacío = sin tope).");
      return;
    }
    const price = pricePerSeat.trim() === "" ? 0 : Number(pricePerSeat);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("El precio por asiento debe ser un número ≥ 0.");
      return;
    }
    setSaving(true);
    const res = await updateOrgBilling({
      organizationId: target.id,
      seatLimit: limit,
      pricePerSeat: price,
      billable,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar el plan.");
      return;
    }
    toast.success("Plan actualizado.");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Plan de {target?.name ?? "la empresa"}</SheetTitle>
          <SheetDescription>
            Tope de asientos y precio por usuario al mes. Se factura por asiento
            activo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Asientos activos hoy: <strong>{target?.activeSeats ?? 0}</strong>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-seats">Tope de asientos</Label>
            <Input
              id="b-seats"
              inputMode="numeric"
              placeholder="Vacío = sin tope"
              value={seatLimit}
              onChange={(e) => setSeatLimit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Máximo de usuarios activos que puede tener la empresa. Vacío = sin
              límite.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-price">Precio por asiento / mes (US$)</Label>
            <Input
              id="b-price"
              inputMode="decimal"
              placeholder="0.00"
              value={pricePerSeat}
              onChange={(e) => setPricePerSeat(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Entra al reporte de facturación
          </label>
          <p className="-mt-2 text-xs text-muted-foreground">
            Desmárcalo para orgs internas o de prueba (no se facturan).
          </p>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar plan"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
