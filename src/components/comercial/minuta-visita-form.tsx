"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, RowDelete, Section, inp } from "@/components/comercial/form-kit";
import {
  type Acuerdo,
  type MinutaData,
  type Participante,
} from "@/lib/comercial/minuta";
import { createClient } from "@/lib/supabase/client";

export function MinutaVisitaForm({
  recordId,
  recordLabel,
  formatCode,
  status: initialStatus,
  elaboradoPor,
  initial,
}: {
  recordId: string;
  recordLabel: string;
  formatCode: string;
  status: string;
  elaboradoPor: string;
  initial: MinutaData;
}) {
  const router = useRouter();
  const [d, setD] = useState<MinutaData>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MinutaData>(k: K, v: MinutaData[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  // ---- participantes ----
  const setPart = (i: number, patch: Partial<Participante>) =>
    setD((p) => ({
      ...p,
      participantes: p.participantes.map((x, j) =>
        j === i ? { ...x, ...patch } : x,
      ),
    }));
  const addPart = () =>
    setD((p) => ({
      ...p,
      participantes: [...p.participantes, { nombre: "", cargo: "", empresa: "" }],
    }));
  const delPart = (i: number) =>
    setD((p) => ({
      ...p,
      participantes: p.participantes.filter((_, j) => j !== i),
    }));

  // ---- temas tratados ----
  const setTema = (i: number, v: string) =>
    setD((p) => ({
      ...p,
      temas_tratados: p.temas_tratados.map((x, j) => (j === i ? v : x)),
    }));
  const addTema = () =>
    setD((p) => ({ ...p, temas_tratados: [...p.temas_tratados, ""] }));
  const delTema = (i: number) =>
    setD((p) => ({
      ...p,
      temas_tratados: p.temas_tratados.filter((_, j) => j !== i),
    }));

  // ---- acuerdos ----
  const setAc = (i: number, patch: Partial<Acuerdo>) =>
    setD((p) => ({
      ...p,
      acuerdos: p.acuerdos.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));
  const addAc = () =>
    setD((p) => ({
      ...p,
      acuerdos: [...p.acuerdos, { descripcion: "", responsable: "" }],
    }));
  const delAc = (i: number) =>
    setD((p) => ({ ...p, acuerdos: p.acuerdos.filter((_, j) => j !== i) }));

  async function persist(nextStatus?: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("doc_save_record", {
        p_record: recordId,
        p_title: d.cliente.trim(),
        p_data: d,
        p_status: nextStatus ?? "",
      });
      if (error) {
        toast.error("No se guardó", { description: error.message, duration: 10000 });
        return false;
      }
      return true;
    } catch (e) {
      toast.error("No se guardó", {
        description: e instanceof Error ? e.message : "Error de conexión.",
        duration: 10000,
      });
      return false;
    }
  }

  async function guardar() {
    if (saving) return;
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (ok) {
      toast.success("Minuta guardada.");
      router.refresh();
    }
  }

  async function descargarPdf() {
    if (saving) return;
    setSaving(true);
    const ok = await persist(); // el PDF sale de lo guardado
    setSaving(false);
    if (!ok) return;
    window.open(`/api/comercial/minuta/${recordId}/pdf`, "_blank");
  }

  async function completar() {
    if (saving) return;
    if (!d.cliente.trim()) {
      toast.error("Pon al menos el cliente antes de completar.");
      return;
    }
    setSaving(true);
    const ok = await persist("completado");
    setSaving(false);
    if (ok) {
      setStatus("completado");
      toast.success("Minuta completada.");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">{recordLabel}</span>
          {status === "completado" ? (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Completado
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Borrador
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={descargarPdf}
            disabled={saving}
            title="Guarda y descarga la minuta en PDF"
          >
            <Download className="size-4" />
            Descargar PDF
          </Button>
          {status !== "completado" && (
            <Button variant="outline" onClick={completar} disabled={saving}>
              <Check className="size-4" />
              Completar
            </Button>
          )}
          <Button onClick={guardar} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {/* Datos del cliente */}
      <Section title="Datos del cliente">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <input className={inp} value={d.cliente} onChange={(e) => set("cliente", e.target.value)} />
          </Field>
          <Field label="Contacto">
            <input className={inp} value={d.contacto} onChange={(e) => set("contacto", e.target.value)} />
          </Field>
          <Field label="Cargo">
            <input className={inp} value={d.cargo} onChange={(e) => set("cargo", e.target.value)} />
          </Field>
          <Field label="Fecha de la visita">
            <input type="date" className={inp} value={d.fecha_visita} onChange={(e) => set("fecha_visita", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tema de la reunión">
              <input className={inp} value={d.tema_reunion} onChange={(e) => set("tema_reunion", e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      {/* Participantes */}
      <Section title="Participantes" onAdd={addPart} addLabel="Agregar participante">
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground sm:grid">
            <span>Nombre y apellido</span>
            <span>Cargo</span>
            <span>Empresa</span>
            <span />
          </div>
          {d.participantes.map((p, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input className={inp} placeholder="Nombre" value={p.nombre} onChange={(e) => setPart(i, { nombre: e.target.value })} />
              <input className={inp} placeholder="Cargo" value={p.cargo} onChange={(e) => setPart(i, { cargo: e.target.value })} />
              <input className={inp} placeholder="Empresa" value={p.empresa} onChange={(e) => setPart(i, { empresa: e.target.value })} />
              <RowDelete onClick={() => delPart(i)} disabled={d.participantes.length === 1} />
            </div>
          ))}
        </div>
      </Section>

      {/* Temas tratados */}
      <Section title="Temas tratados" onAdd={addTema} addLabel="Agregar tema">
        <div className="space-y-2">
          {d.temas_tratados.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                className={inp + " min-h-9 py-2"}
                rows={2}
                placeholder="Descripción del tema tratado…"
                value={t}
                onChange={(e) => setTema(i, e.target.value)}
              />
              <RowDelete onClick={() => delTema(i)} disabled={d.temas_tratados.length === 1} />
            </div>
          ))}
        </div>
      </Section>

      {/* Acuerdos y compromisos */}
      <Section title="Acuerdos y compromisos" onAdd={addAc} addLabel="Agregar acuerdo">
        <div className="space-y-2">
          <div className="hidden grid-cols-[2fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground sm:grid">
            <span>Descripción</span>
            <span>Responsable</span>
            <span />
          </div>
          {d.acuerdos.map((a, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto]">
              <input className={inp} placeholder="Compromiso / acuerdo" value={a.descripcion} onChange={(e) => setAc(i, { descripcion: e.target.value })} />
              <input className={inp} placeholder="Responsable" value={a.responsable} onChange={(e) => setAc(i, { responsable: e.target.value })} />
              <RowDelete onClick={() => delAc(i)} disabled={d.acuerdos.length === 1} />
            </div>
          ))}
        </div>
      </Section>

      {/* Cierre */}
      <Section title="Cierre">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Próxima reunión">
            <input className={inp} placeholder="Fecha o N/A" value={d.proxima_reunion} onChange={(e) => set("proxima_reunion", e.target.value)} />
          </Field>
          <Field label="Elaborado por">
            <input className={inp + " bg-muted/40"} value={elaboradoPor} readOnly title="Se toma del usuario que registra" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observaciones (opcional)">
              <textarea
                className={inp + " min-h-9 py-2"}
                rows={2}
                value={d.observaciones}
                onChange={(e) => set("observaciones", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Section>

      <p className="text-center text-xs text-muted-foreground">
        Formato {formatCode} · {recordLabel}
      </p>
    </main>
  );
}
