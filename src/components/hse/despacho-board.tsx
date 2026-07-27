"use client";

import { useRef, useState } from "react";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/ui/signature-pad";
import { createClient } from "@/lib/supabase/client";

const inp =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
const BUCKET = "hse-evidence";

type EmpOpt = { id: string; nombre: string };
type ItemOpt = { id: string; nombre: string; stock_actual: number; vida_util_dias: number | null };

export function DespachoBoard({
  orgId,
  empleados,
  items,
}: {
  orgId: string;
  empleados: EmpOpt[];
  items: ItemOpt[];
}) {
  const sb = createClient();
  const padRef = useRef<SignaturePadHandle>(null);
  const [empId, setEmpId] = useState("");
  const [eppId, setEppId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.stock_actual])),
  );

  const selItem = items.find((i) => i.id === eppId);

  async function despachar() {
    if (saving) return;
    if (!empId) return toast.error("Elige el colaborador.");
    if (!eppId) return toast.error("Elige el EPP.");
    const qty = parseInt(cantidad) || 0;
    if (qty <= 0) return toast.error("Cantidad inválida.");
    if (qty > (stock[eppId] ?? 0)) return toast.error("No hay stock suficiente.");
    if (padRef.current?.isEmpty()) return toast.error("Falta la firma del colaborador.");

    setSaving(true);
    const blob = await padRef.current?.toBlob();
    if (!blob) {
      setSaving(false);
      return toast.error("No se pudo capturar la firma.");
    }
    const path = `${orgId}/despacho/${crypto.randomUUID()}.png`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/png" });
    if (up.error) {
      setSaving(false);
      return toast.error("No se pudo subir la firma.");
    }

    let venc: string | null = null;
    if (selItem?.vida_util_dias) {
      const d = new Date();
      d.setDate(d.getDate() + selItem.vida_util_dias);
      venc = d.toISOString().split("T")[0];
    }
    const { data: userRes } = await sb.auth.getUser();
    const { error } = await sb.from("hse_epp_asignaciones").insert({
      organization_id: orgId,
      empleado_id: empId,
      epp_id: eppId,
      cantidad: qty,
      firma_path: path,
      notas: notas.trim() || null,
      fecha_vencimiento: venc,
      entregado_por: userRes.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error("No se pudo despachar.");

    setStock((s) => ({ ...s, [eppId]: (s[eppId] ?? 0) - qty }));
    toast.success("EPP despachado y firmado.");
    setEmpId("");
    setEppId("");
    setCantidad("1");
    setNotas("");
    padRef.current?.clear();
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Despacho EPP</h1>
        <p className="text-sm text-muted-foreground">
          Entrega con firma del colaborador. Descuenta stock automáticamente.
        </p>
      </div>

      {items.length === 0 || empleados.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <PackageOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          Necesitas al menos un colaborador y un ítem de inventario para despachar.
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Colaborador</span>
            <select className={inp} value={empId} onChange={(e) => setEmpId(e.target.value)}>
              <option value="">Elige…</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">EPP</span>
            <select className={inp} value={eppId} onChange={(e) => setEppId(e.target.value)}>
              <option value="">Elige…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} (stock: {stock[i.id] ?? 0})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Cantidad</span>
              <input type="number" inputMode="numeric" className={inp} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </label>
            {selItem && (
              <div className="flex items-end pb-2 text-xs text-muted-foreground">
                Disponible: {stock[eppId] ?? 0}
                {selItem.vida_util_dias ? ` · vence en ${selItem.vida_util_dias} d` : ""}
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Notas (opcional)</span>
            <input className={inp} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </label>

          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Firma del colaborador</span>
            <SignaturePad ref={padRef} className="h-40 w-full rounded-lg border-2 border-dashed bg-white" />
            <button
              onClick={() => padRef.current?.clear()}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar firma
            </button>
          </div>

          <Button className="w-full" onClick={despachar} disabled={saving}>
            {saving ? "Despachando…" : "Despachar y firmar"}
          </Button>
        </div>
      )}
    </div>
  );
}
