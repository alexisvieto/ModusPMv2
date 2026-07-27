"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  GRUPOS_PERMISOS,
  SUBTIPO_LABELS,
  TIPO_PERMISOS,
  initChecklist,
  type PermitGroupKey,
  type PermitTypeKey,
} from "@/lib/hse/permits";
import { createClient } from "@/lib/supabase/client";

export function NewPermitButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [grupo, setGrupo] = useState<PermitGroupKey | null>(null);
  const [saving, setSaving] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setGrupo(null);
  }

  async function create(type: PermitTypeKey) {
    if (saving) return;
    setSaving(true);
    const sb = createClient();
    const { data: userRes } = await sb.auth.getUser();
    let emisor = userRes.user?.email ?? "";
    if (userRes.user) {
      const { data: prof } = await sb
        .from("profiles")
        .select("full_name")
        .eq("id", userRes.user.id)
        .maybeSingle();
      emisor = prof?.full_name ?? emisor;
    }
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await sb
      .from("hse_permits")
      .insert({
        organization_id: orgId,
        permit_type: type,
        fecha: today,
        fecha_inicio: today,
        emisor_nombre: emisor,
        checklist: initChecklist(type),
        personal: [],
        created_by: userRes.user?.id ?? null,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error("No se pudo crear el permiso.");
      return;
    }
    router.push(`/app/hse/permisos/${data.id}`);
  }

  const grupos = Object.entries(GRUPOS_PERMISOS) as [
    PermitGroupKey,
    (typeof GRUPOS_PERMISOS)[PermitGroupKey],
  ][];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo permiso
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            <Dialog.Title className="text-base font-semibold">
              Nuevo permiso de trabajo
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
              {grupo ? "Selecciona el subtipo" : "Selecciona el tipo de trabajo"}
            </Dialog.Description>

            <div className="mt-4 space-y-2">
              {!grupo
                ? grupos.map(([key, val]) => (
                    <button
                      key={key}
                      disabled={saving}
                      onClick={() =>
                        val.subtipos ? setGrupo(key) : create(key as PermitTypeKey)
                      }
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <span className="text-2xl">{val.icon}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0f2044]">{val.label}</div>
                        {val.subtipos && (
                          <div className="text-xs text-muted-foreground">
                            Andamios · Torres · Escalera
                          </div>
                        )}
                      </div>
                      {val.subtipos && (
                        <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                      )}
                    </button>
                  ))
                : (GRUPOS_PERMISOS[grupo].subtipos ?? []).map((key) => (
                    <button
                      key={key}
                      disabled={saving}
                      onClick={() => create(key)}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <span className="text-2xl">{TIPO_PERMISOS[key].icon}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0f2044]">
                          {SUBTIPO_LABELS[key].label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {SUBTIPO_LABELS[key].desc}
                        </div>
                      </div>
                    </button>
                  ))}
            </div>

            <div className="mt-4 flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (grupo ? setGrupo(null) : setOpen(false))}
              >
                {grupo ? "‹ Volver" : "Cancelar"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
