"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, MapPin, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Section, inp } from "@/components/comercial/form-kit";
import { PhotoGallery } from "@/components/operaciones/photo-gallery";
import { type SiteSurveyData, type SurveyPhoto } from "@/lib/operaciones/site-survey";
import { createClient } from "@/lib/supabase/client";

export function SiteSurveyForm({
  recordId,
  recordLabel,
  formatCode,
  status: initialStatus,
  elaboradoPor,
  org,
  initial,
  photoUrls,
}: {
  recordId: string;
  recordLabel: string;
  formatCode: string;
  status: string;
  elaboradoPor: string;
  org: string;
  initial: SiteSurveyData;
  photoUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [d, setD] = useState<SiteSurveyData>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  const set = <K extends keyof SiteSurveyData>(k: K, v: SiteSurveyData[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  function capturarGps() {
    if (!navigator.geolocation) {
      toast.error("Este dispositivo no permite ubicación.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        setD((p) => ({
          ...p,
          coord_lat: pos.coords.latitude.toFixed(6),
          coord_lng: pos.coords.longitude.toFixed(6),
        }));
        toast.success("Coordenadas capturadas.");
      },
      () => {
        setGeoBusy(false);
        toast.error("No se pudo obtener la ubicación. Escríbela a mano.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function persist(nextStatus?: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("doc_save_record", {
        p_record: recordId,
        p_title: (d.cliente || d.objeto_licitacion).trim(),
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
      toast.success("Site survey guardado.");
      router.refresh();
    }
  }

  async function descargarPdf() {
    if (saving) return;
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (!ok) return;
    window.open(`/api/operaciones/site-survey/${recordId}/pdf`, "_blank");
  }

  async function completar() {
    if (saving) return;
    if (!d.cliente.trim() && !d.objeto_licitacion.trim()) {
      toast.error("Pon al menos el cliente o el objeto de la licitación.");
      return;
    }
    setSaving(true);
    const ok = await persist("completado");
    setSaving(false);
    if (ok) {
      setStatus("completado");
      toast.success("Site survey completado.");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      {/* Acciones */}
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
            title="Guarda y descarga el site survey en PDF"
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

      {/* 1. Datos Generales */}
      <Section title="Datos Generales">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Objeto de la licitación">
              <input className={inp} value={d.objeto_licitacion} onChange={(e) => set("objeto_licitacion", e.target.value)} />
            </Field>
          </div>
          <Field label="Código">
            <input className={inp} value={d.codigo} onChange={(e) => set("codigo", e.target.value)} />
          </Field>
          <Field label="Cliente">
            <input className={inp} value={d.cliente} onChange={(e) => set("cliente", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alcance">
              <textarea className={inp + " min-h-9 py-2"} rows={2} value={d.alcance} onChange={(e) => set("alcance", e.target.value)} />
            </Field>
          </div>
          <Field label="Precio de referencia">
            <input className={inp} value={d.precio_referencia} onChange={(e) => set("precio_referencia", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* 2. Datos del Sitio */}
      <Section title="Datos del Sitio">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitud">
            <input className={inp} value={d.coord_lat} onChange={(e) => set("coord_lat", e.target.value)} placeholder="Ej. 8.982000" />
          </Field>
          <Field label="Longitud">
            <input className={inp} value={d.coord_lng} onChange={(e) => set("coord_lng", e.target.value)} placeholder="Ej. -79.519000" />
          </Field>
          <div className="sm:col-span-2">
            <Button variant="outline" size="sm" onClick={capturarGps} disabled={geoBusy}>
              <MapPin className="size-4" />
              {geoBusy ? "Ubicando…" : "Capturar coordenadas (GPS)"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">Función solo desde Móvil</p>
          </div>
          <div className="sm:col-span-2">
            <Field label="Encargado o administrador del sitio">
              <input className={inp} value={d.encargado} onChange={(e) => set("encargado", e.target.value)} />
            </Field>
          </div>
          <Field label="Tipo de zona">
            <input className={inp} value={d.tipo_zona} onChange={(e) => set("tipo_zona", e.target.value)} />
          </Field>
          <Field label="Facilidades">
            <input className={inp} value={d.facilidades} onChange={(e) => set("facilidades", e.target.value)} />
          </Field>
          <Field label="Acceso">
            <input className={inp} value={d.acceso} onChange={(e) => set("acceso", e.target.value)} />
          </Field>
          <Field label="Condiciones de relieve del terreno">
            <input className={inp} value={d.relieve} onChange={(e) => set("relieve", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <PhotoGallery
            org={org}
            recordId={recordId}
            label="Fotografías del sitio"
            value={d.fotos_sitio}
            onChange={(v: SurveyPhoto[]) => set("fotos_sitio", v)}
            urls={photoUrls}
          />
        </div>
      </Section>

      {/* 3. Detalles técnicos e informe fotográfico */}
      <Section title="Detalles técnicos e informe fotográfico">
        <Field label="Información general">
          <textarea className={inp + " min-h-9 py-2"} rows={4} value={d.info_general} onChange={(e) => set("info_general", e.target.value)} />
        </Field>
        <div className="mt-4">
          <PhotoGallery
            org={org}
            recordId={recordId}
            label="Informe fotográfico"
            value={d.fotos_tecnicas}
            onChange={(v: SurveyPhoto[]) => set("fotos_tecnicas", v)}
            urls={photoUrls}
          />
        </div>
      </Section>

      <p className="text-center text-xs text-muted-foreground">
        Formato {formatCode} · {recordLabel} · Elaborado por {elaboradoPor || "—"}
      </p>
    </main>
  );
}
