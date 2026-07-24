"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { DEFAULT_PARAMS } from "@/lib/nexus/calc";
import { createClient } from "@/lib/supabase/client";

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function NewEstimateButton({
  orgId,
  divisions,
}: {
  orgId: string;
  divisions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [odoo, setOdoo] = useState("");
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  // Reset al abrir (ajuste de estado en render, patrón del repo).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setClient("");
      setOdoo("");
      setDivisionId(divisions[0]?.id ?? "");
    }
  }

  async function create() {
    if (saving) return;
    if (!name.trim()) {
      toast.error("Ponle un nombre a la cotización.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const [{ data: s }, { data: userRes }] = await Promise.all([
      supabase
        .from("nexus_settings")
        .select("ind_oficina, ind_campo, financiamiento, utilidad, itbms")
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);
    const params = s
      ? {
          ind_oficina: Number(s.ind_oficina),
          ind_campo: Number(s.ind_campo),
          financiamiento: Number(s.financiamiento),
          utilidad: Number(s.utilidad),
          itbms: Number(s.itbms),
        }
      : DEFAULT_PARAMS;

    let elaboratedBy: string | null = userRes.user?.email ?? null;
    if (userRes.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userRes.user.id)
        .maybeSingle();
      elaboratedBy = prof?.full_name ?? elaboratedBy;
    }

    const { data, error } = await supabase
      .from("nexus_estimates")
      .insert({
        organization_id: orgId,
        division_id: divisionId || null,
        name: name.trim(),
        client_name: client.trim() || null,
        odoo_code: odoo.trim() || null,
        elaborated_by: elaboratedBy,
        elaborated_user_id: userRes.user?.id ?? null,
        params,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error("No se pudo crear la cotización.");
      return;
    }
    router.push(`/app/nexus/${data.id}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nueva cotización
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nueva cotización</SheetTitle>
            <SheetDescription>
              Nombre, cliente y división. Los % se toman de la config de la
              organización y podés ajustarlos dentro.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="ne-name">Nombre de la cotización</Label>
              <Input
                id="ne-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. ASSA Control de Acceso"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ne-client">Cliente</Label>
              <Input
                id="ne-client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Ej. ASSA"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ne-odoo">Código Odoo (S00XXX)</Label>
              <Input
                id="ne-odoo"
                value={odoo}
                onChange={(e) => setOdoo(e.target.value)}
                placeholder="Ej. S00549 — opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ne-div">División</Label>
              <select
                id="ne-div"
                className={fieldCls}
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <SheetFooter>
            <Button onClick={create} disabled={saving}>
              {saving ? "Creando…" : "Crear y abrir"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
