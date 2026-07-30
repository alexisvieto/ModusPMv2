"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Copy, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENCUESTA_TIPOS, encuestaDef } from "@/lib/comercial/encuesta";
import { createClient } from "@/lib/supabase/client";

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function SurveyGenerateButton({ formatId }: { formatId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("suministro");
  const [cliente, setCliente] = useState("");
  const [referencia, setReferencia] = useState("");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setTipo("suministro");
      setCliente("");
      setReferencia("");
      setSaving(false);
      setLink(null);
      setCopied(false);
    }
  }

  async function crear() {
    if (saving) return;
    if (!cliente.trim()) {
      toast.error("Pon el nombre del cliente.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("doc_create_survey", {
      p_format: formatId,
      p_cliente: cliente.trim(),
      p_referencia: referencia.trim(),
      p_tipo: tipo,
    });
    setSaving(false);
    const r = data as { token?: string } | null;
    if (error || !r?.token) {
      toast.error(error?.message ?? "No se pudo generar el enlace.");
      return;
    }
    setLink(`${window.location.origin}/encuesta/${r.token}`);
    router.refresh();
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  const waHref = link
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola, agradecemos que respondas nuestra breve encuesta de satisfacción: ${link}`,
      )}`
    : "#";

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Link2 className="size-4" />
        Generar enlace
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Dialog.Title className="text-lg font-semibold">
              Enlace de encuesta
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Genera un enlace para que el cliente responda desde su celular, sin
              iniciar sesión.
            </Dialog.Description>

            {link ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm text-success">
                  Enlace listo. Compártelo con el cliente — la respuesta llega aquí
                  automáticamente.
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    className="h-9 flex-1 rounded-md border border-input bg-muted/40 px-3 text-xs outline-none"
                  />
                  <Button variant="outline" size="sm" onClick={copiar}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </a>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Abrir
                  </a>
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={() => setOpen(false)}>Listo</Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sg-tipo">Tipo de encuesta</Label>
                  <select
                    id="sg-tipo"
                    className={fieldCls}
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                  >
                    {ENCUESTA_TIPOS.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sg-cliente">Cliente</Label>
                  <Input
                    id="sg-cliente"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder="Nombre del cliente"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sg-ref">{encuestaDef(tipo).refLabel} (opcional)</Label>
                  <Input
                    id="sg-ref"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder={tipo === "obra" ? "Ej. Data Center Fase 2" : "Ej. Cámaras de seguridad"}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={crear} disabled={saving}>
                    {saving ? "Generando…" : "Generar enlace"}
                  </Button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
