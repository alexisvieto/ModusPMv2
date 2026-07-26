"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function NewSurveyButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  const [project, setProject] = useState("");
  const [site, setSite] = useState("");
  const [saving, setSaving] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setClient("");
      setProject("");
      setSite("");
    }
  }

  async function create() {
    if (saving) return;
    setSaving(true);
    const supabase = createClient();
    const { data: userRes } = await supabase.auth.getUser();
    let engineer: string | null = userRes.user?.email ?? null;
    if (userRes.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userRes.user.id)
        .maybeSingle();
      engineer = prof?.full_name ?? engineer;
    }

    const { data, error } = await supabase
      .from("survey_surveys")
      .insert({
        organization_id: orgId,
        client_name: client.trim() || null,
        project_name: project.trim() || null,
        site_location: site.trim() || null,
        engineer_name: engineer,
        engineer_user_id: userRes.user?.id ?? null,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error("No se pudo crear el survey.");
      return;
    }
    router.push(`/app/survey/${data.id}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo survey
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="mb-5 text-center">
              <Dialog.Title className="text-lg font-semibold">
                Nuevo survey
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Registra el sitio a inspeccionar. El detalle se completa en campo.
              </Dialog.Description>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ns-client">Cliente</Label>
                <Input
                  id="ns-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Ej. ASSA"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ns-project">Proyecto</Label>
                <Input
                  id="ns-project"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="Ej. Radio Enlaces Cerro Galera"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ns-site">Sitio / ubicación</Label>
                <Input
                  id="ns-site"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="Dirección o referencia del sitio"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={create} disabled={saving}>
                {saving ? "Creando…" : "Crear y abrir"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
