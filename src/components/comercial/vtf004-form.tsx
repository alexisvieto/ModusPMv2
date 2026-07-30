"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, RowDelete, Section, inp, lbl } from "@/components/comercial/form-kit";
import {
  FRECUENCIA_OPTS,
  type Frecuencia,
  type PersonaSimple,
  type TemaVt,
  type VtF004Data,
} from "@/lib/comercial/vtf004";
import { createClient } from "@/lib/supabase/client";

export function VtF004Form({
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
  initial: VtF004Data;
}) {
  const router = useRouter();
  const [d, setD] = useState<VtF004Data>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof VtF004Data>(k: K, v: VtF004Data[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  // personal (ingesoft / cliente) — repetibles
  const setPers = (
    key: "personal_ingesoft" | "personal_cliente",
    i: number,
    patch: Partial<PersonaSimple>,
  ) =>
    setD((p) => ({
      ...p,
      [key]: p[key].map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));
  const addPers = (key: "personal_ingesoft" | "personal_cliente") =>
    setD((p) => ({ ...p, [key]: [...p[key], { nombre: "", cargo: "" }] }));
  const delPers = (key: "personal_ingesoft" | "personal_cliente", i: number) =>
    setD((p) => ({ ...p, [key]: p[key].filter((_, j) => j !== i) }));

  // temas
  const setTema = (i: number, patch: Partial<TemaVt>) =>
    setD((p) => ({
      ...p,
      temas: p.temas.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));
  const addTema = () =>
    setD((p) => ({
      ...p,
      temas: [...p.temas, { punto: "", responsable: "", fecha: "" }],
    }));
  const delTema = (i: number) =>
    setD((p) => ({ ...p, temas: p.temas.filter((_, j) => j !== i) }));

  async function persist(nextStatus?: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("doc_save_record", {
        p_record: recordId,
        p_title: d.cliente.trim(),
        p_data: d as never,
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
      toast.success("Visita técnica guardada.");
      router.refresh();
    }
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
      toast.success("Visita técnica completada.");
      router.refresh();
    }
  }

  async function descargarPdf() {
    if (saving) return;
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (!ok) return;
    window.open(`/api/comercial/vtf004/${recordId}/pdf`, "_blank");
  }

  const persTable = (key: "personal_ingesoft" | "personal_cliente") => (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1.4fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground sm:grid">
        <span>Nombre y apellido</span>
        <span>Cargo</span>
        <span />
      </div>
      {d[key].map((p, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
          <input className={inp} placeholder="Nombre" value={p.nombre} onChange={(e) => setPers(key, i, { nombre: e.target.value })} />
          <input className={inp} placeholder="Cargo" value={p.cargo} onChange={(e) => setPers(key, i, { cargo: e.target.value })} />
          <RowDelete onClick={() => delPers(key, i)} disabled={d[key].length === 1} />
        </div>
      ))}
    </div>
  );

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
          <Button variant="outline" onClick={descargarPdf} disabled={saving} title="Guarda y descarga en PDF">
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

      {/* General */}
      <Section title="Datos generales">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <input className={inp} value={d.cliente} onChange={(e) => set("cliente", e.target.value)} />
          </Field>
          <Field label="Fecha">
            <input type="date" className={inp} value={d.fecha} onChange={(e) => set("fecha", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Objetivo(s)">
              <textarea className={inp + " min-h-9 py-2"} rows={2} value={d.objetivos} onChange={(e) => set("objetivos", e.target.value)} />
            </Field>
          </div>
        </div>
        {/* Frecuencia */}
        <div className="mt-3">
          <span className={lbl}>Frecuencia</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {FRECUENCIA_OPTS.map((o) => (
              <label key={o.v} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="frecuencia"
                  className="size-4"
                  checked={d.frecuencia === o.v}
                  onChange={() => set("frecuencia", o.v as Frecuencia)}
                />
                {o.l}
              </label>
            ))}
            {d.frecuencia === "otros" && (
              <input
                className={inp + " w-48"}
                placeholder="Especifique…"
                value={d.frecuencia_otros}
                onChange={(e) => set("frecuencia_otros", e.target.value)}
              />
            )}
          </div>
        </div>
      </Section>

      {/* Personal Ingesoft */}
      <Section
        title="Personal de Ingesoft que participa"
        onAdd={() => addPers("personal_ingesoft")}
        addLabel="Agregar"
      >
        {persTable("personal_ingesoft")}
      </Section>

      {/* Personal Cliente */}
      <Section
        title="Personal del cliente (retroalimentación)"
        onAdd={() => addPers("personal_cliente")}
        addLabel="Agregar"
      >
        {persTable("personal_cliente")}
      </Section>

      {/* Observaciones */}
      <Section title="Observaciones">
        <div className="space-y-3">
          <Field label="Estructurales (si aplica)">
            <textarea className={inp + " min-h-9 py-2"} rows={2} value={d.obs_estructurales} onChange={(e) => set("obs_estructurales", e.target.value)} />
          </Field>
          <Field label="Técnicas (si aplica)">
            <textarea className={inp + " min-h-9 py-2"} rows={2} value={d.obs_tecnicas} onChange={(e) => set("obs_tecnicas", e.target.value)} />
          </Field>
          <Field label="Condiciones generales">
            <textarea className={inp + " min-h-9 py-2"} rows={2} value={d.obs_condiciones} onChange={(e) => set("obs_condiciones", e.target.value)} />
          </Field>
          <Field label="Otras observaciones">
            <textarea className={inp + " min-h-9 py-2"} rows={2} value={d.obs_otras} onChange={(e) => set("obs_otras", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Temas / compromisos */}
      <Section
        title="Temas tratados, oportunidades de mejora o compromisos"
        onAdd={addTema}
        addLabel="Agregar punto"
      >
        <div className="space-y-2">
          <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground sm:grid">
            <span>Puntos</span>
            <span>Responsable</span>
            <span>Fecha</span>
            <span />
          </div>
          {d.temas.map((t, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input className={inp} placeholder="Punto / compromiso" value={t.punto} onChange={(e) => setTema(i, { punto: e.target.value })} />
              <input className={inp} placeholder="Responsable" value={t.responsable} onChange={(e) => setTema(i, { responsable: e.target.value })} />
              <input type="date" className={inp} value={t.fecha} onChange={(e) => setTema(i, { fecha: e.target.value })} />
              <RowDelete onClick={() => delTema(i)} disabled={d.temas.length === 1} />
            </div>
          ))}
        </div>
      </Section>

      {/* Elaborado por */}
      <Section title="Cierre">
        <Field label="Elaborado por">
          <input className={inp + " bg-muted/40 sm:max-w-xs"} value={elaboradoPor} readOnly title="Se toma del usuario que registra" />
        </Field>
      </Section>

      <p className="text-center text-xs text-muted-foreground">
        Formato {formatCode} · {recordLabel}
      </p>
    </main>
  );
}
