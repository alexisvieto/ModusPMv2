"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { FileDown, PenLine, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/ui/signature-pad";
import {
  TIPO_PERMISOS,
  type ChecklistFilled,
  type PermitTypeKey,
} from "@/lib/hse/permits";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
const BUCKET = "hse-evidence";

type PermitProps = {
  id: string;
  organization_id: string;
  permit_type: PermitTypeKey;
  empresa: string;
  ciudad_lugar: string;
  area_proceso: string;
  ubicacion: string;
  fecha: string;
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio: string;
  hora_fin: string;
  descripcion_tarea: string;
  altura_estimada: string;
  equipo_a_usar: string;
  emisor_nombre: string;
  emisor_cedula: string;
  emisor_firma_path: string | null;
  vigia_nombre: string;
  vigia_cedula: string;
  vigia_firma_path: string | null;
  observaciones: string;
  estado: string;
};
type PersonalRow = {
  nombre: string;
  cedula: string;
  firma_path: string | null;
  firma_url: string;
};
type SigTarget = "emisor" | "vigia" | number | null;

export function PermitEditor({
  permit,
  initialPersonal,
  initialChecklist,
  firmaUrls,
}: {
  permit: PermitProps;
  initialPersonal: PersonalRow[];
  initialChecklist: ChecklistFilled[];
  firmaUrls: { emisor: string; vigia: string };
}) {
  const router = useRouter();
  const sb = createClient();
  const org = permit.organization_id;
  const meta = TIPO_PERMISOS[permit.permit_type];
  const MetaIcon = meta?.icon;
  const esAltura = meta?.grupo === "altura";

  const [f, setF] = useState({
    empresa: permit.empresa,
    ciudad_lugar: permit.ciudad_lugar,
    area_proceso: permit.area_proceso,
    ubicacion: permit.ubicacion,
    fecha: permit.fecha,
    fecha_inicio: permit.fecha_inicio,
    fecha_fin: permit.fecha_fin,
    hora_inicio: permit.hora_inicio,
    hora_fin: permit.hora_fin,
    descripcion_tarea: permit.descripcion_tarea,
    altura_estimada: permit.altura_estimada,
    equipo_a_usar: permit.equipo_a_usar,
    emisor_nombre: permit.emisor_nombre,
    emisor_cedula: permit.emisor_cedula,
    vigia_nombre: permit.vigia_nombre,
    vigia_cedula: permit.vigia_cedula,
    observaciones: permit.observaciones,
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [personal, setPersonal] = useState<PersonalRow[]>(initialPersonal);
  const [checklist, setChecklist] = useState<ChecklistFilled[]>(initialChecklist);
  const [emisorFirma, setEmisorFirma] = useState({
    path: permit.emisor_firma_path,
    url: firmaUrls.emisor,
  });
  const [vigiaFirma, setVigiaFirma] = useState({
    path: permit.vigia_firma_path,
    url: firmaUrls.vigia,
  });
  const [estado, setEstado] = useState(permit.estado);
  const [saving, setSaving] = useState(false);

  // ── checklist: null → cumple → no cumple → null ──
  function cycleItem(si: number, ii: number) {
    setChecklist((prev) =>
      prev.map((sec, s) =>
        s !== si
          ? sec
          : {
              ...sec,
              items: sec.items.map((it, i) =>
                i !== ii
                  ? it
                  : { ...it, cumple: it.cumple === null ? true : it.cumple ? false : null },
              ),
            },
      ),
    );
  }

  // ── personal ──
  function addPersonal() {
    setPersonal((p) => [...p, { nombre: "", cedula: "", firma_path: null, firma_url: "" }]);
  }
  function patchPersonal(i: number, patch: Partial<PersonalRow>) {
    setPersonal((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removePersonal(i: number) {
    setPersonal((p) => p.filter((_, idx) => idx !== i));
  }

  // ── firmas ──
  const padRef = useRef<SignaturePadHandle>(null);
  const [sigTarget, setSigTarget] = useState<SigTarget>(null);
  const [savingSig, setSavingSig] = useState(false);

  async function saveSignature() {
    if (savingSig) return;
    if (padRef.current?.isEmpty()) return toast.error("La firma está vacía.");
    setSavingSig(true);
    const blob = await padRef.current?.toBlob();
    if (!blob) {
      setSavingSig(false);
      return toast.error("No se pudo capturar la firma.");
    }
    const path = `${org}/${permit.id}/firmas/${crypto.randomUUID()}.png`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: "image/png",
    });
    if (up.error) {
      setSavingSig(false);
      return toast.error("No se pudo subir la firma.");
    }
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    const url = signed?.signedUrl ?? "";

    // Estado local + PERSISTIR la firma de inmediato (no esperar a "Guardar",
    // para que en campo la firma no se pierda si se cierra la pestaña).
    let nextPersonal = personal;
    if (sigTarget === "emisor") setEmisorFirma({ path, url });
    else if (sigTarget === "vigia") setVigiaFirma({ path, url });
    else if (typeof sigTarget === "number") {
      nextPersonal = personal.map((p, idx) =>
        idx === sigTarget ? { ...p, firma_path: path, firma_url: url } : p,
      );
      setPersonal(nextPersonal);
    }

    const emisorPath = sigTarget === "emisor" ? path : emisorFirma.path;
    const vigiaPath = sigTarget === "vigia" ? path : vigiaFirma.path;
    const aprobado = !!emisorPath && !!vigiaPath;
    const estadoPatch = aprobado ? { estado: "aprobado" } : {};
    if (aprobado) setEstado("aprobado");

    const patch =
      sigTarget === "emisor"
        ? { emisor_firma_path: path, ...estadoPatch }
        : sigTarget === "vigia"
          ? { vigia_firma_path: path, ...estadoPatch }
          : {
              personal: nextPersonal.map((p) => ({
                nombre: p.nombre.trim(),
                cedula: p.cedula.trim(),
                firma_path: p.firma_path,
              })) as unknown as Json,
            };
    const { error: dbErr } = await sb
      .from("hse_permits")
      .update(patch)
      .eq("id", permit.id);
    setSavingSig(false);
    setSigTarget(null);
    if (dbErr) {
      toast.error("Firma subida, pero no se guardó en el permiso.");
      return;
    }
    toast.success("Firma registrada.");
  }

  // ── guardar ──
  async function save() {
    if (saving) return;
    setSaving(true);
    const nextEstado =
      emisorFirma.path && vigiaFirma.path ? "aprobado" : "pendiente";
    const { error } = await sb
      .from("hse_permits")
      .update({
        empresa: f.empresa.trim() || null,
        ciudad_lugar: f.ciudad_lugar.trim() || null,
        area_proceso: f.area_proceso.trim() || null,
        ubicacion: f.ubicacion.trim() || null,
        fecha: f.fecha || null,
        fecha_inicio: f.fecha_inicio || null,
        fecha_fin: f.fecha_fin || null,
        hora_inicio: f.hora_inicio.trim() || null,
        hora_fin: f.hora_fin.trim() || null,
        descripcion_tarea: f.descripcion_tarea.trim() || null,
        altura_estimada: f.altura_estimada.trim() || null,
        equipo_a_usar: f.equipo_a_usar.trim() || null,
        emisor_nombre: f.emisor_nombre.trim() || null,
        emisor_cedula: f.emisor_cedula.trim() || null,
        emisor_firma_path: emisorFirma.path,
        vigia_nombre: f.vigia_nombre.trim() || null,
        vigia_cedula: f.vigia_cedula.trim() || null,
        vigia_firma_path: vigiaFirma.path,
        observaciones: f.observaciones.trim() || null,
        personal: personal.map((p) => ({
          nombre: p.nombre.trim(),
          cedula: p.cedula.trim(),
          firma_path: p.firma_path,
        })) as unknown as Json,
        checklist: checklist as unknown as Json,
        estado: nextEstado,
      })
      .eq("id", permit.id);
    setSaving(false);
    if (error) return toast.error("No se pudo guardar.");
    setEstado(nextEstado);
    toast.success("Permiso guardado.");
    router.refresh();
  }

  function exportPdf() {
    window.open(`/api/hse/${permit.id}/pdf`, "_blank");
  }

  const card = "rounded-xl border bg-card";
  const cardHead = "border-b px-4 py-2.5 text-sm font-semibold";

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      {/* barra */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-xl font-semibold tracking-tight">
            {MetaIcon && <MetaIcon className="size-6 shrink-0 text-[#0f2044]" />}
            {meta?.label}
          </h1>
          <p className="text-xs text-muted-foreground">{f.ubicacion || "Sin ubicación"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {estado === "aprobado" ? "Aprobado" : "Pendiente"}
          </span>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="size-4" /> PDF
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {/* datos del permiso */}
      <div className={card}>
        <div className={cardHead}>Datos del permiso</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Empresa">
            <input className={inp} value={f.empresa} onChange={(e) => set("empresa", e.target.value)} />
          </Field>
          <Field label="Ciudad / Lugar">
            <input className={inp} value={f.ciudad_lugar} onChange={(e) => set("ciudad_lugar", e.target.value)} />
          </Field>
          {/* area_proceso reutilizado como "Código del proyecto" (pedido gerencia HSE) */}
          <Field label="Código del proyecto">
            <input className={inp} value={f.area_proceso} onChange={(e) => set("area_proceso", e.target.value)} />
          </Field>
          <Field label="Ubicación">
            <input className={inp} value={f.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} />
          </Field>
          {esAltura ? (
            <>
              <Field label="Fecha inicio">
                <input type="date" className={inp} value={f.fecha_inicio} onChange={(e) => set("fecha_inicio", e.target.value)} />
              </Field>
              <Field label="Fecha fin">
                <input type="date" className={inp} value={f.fecha_fin} onChange={(e) => set("fecha_fin", e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label="Fecha">
              <input type="date" className={inp} value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
            </Field>
          )}
          <Field label="Hora inicio">
            <input type="time" className={inp} value={f.hora_inicio} onChange={(e) => set("hora_inicio", e.target.value)} />
          </Field>
          <Field label="Hora fin">
            <input type="time" className={inp} value={f.hora_fin} onChange={(e) => set("hora_fin", e.target.value)} />
          </Field>
          {esAltura ? (
            <Field label="Altura estimada">
              <input className={inp} value={f.altura_estimada} onChange={(e) => set("altura_estimada", e.target.value)} placeholder="Ej. 12 m" />
            </Field>
          ) : (
            <Field label="Equipo a usar">
              <input className={inp} value={f.equipo_a_usar} onChange={(e) => set("equipo_a_usar", e.target.value)} />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Descripción de la tarea">
              <textarea
                className={inp + " h-auto py-2"}
                rows={2}
                value={f.descripcion_tarea}
                onChange={(e) => set("descripcion_tarea", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* personal autorizado */}
      <div className={card}>
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Personal autorizado</span>
          <Button variant="outline" size="sm" onClick={addPersonal}>
            <Plus className="size-4" /> Persona
          </Button>
        </div>
        <div className="divide-y">
          {personal.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Sin personal aún.</p>
          )}
          {personal.map((p, i) => (
            <div key={i} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inp} placeholder="Nombre y apellido" value={p.nombre} onChange={(e) => patchPersonal(i, { nombre: e.target.value })} />
                <input className={inp} placeholder="Cédula" value={p.cedula} onChange={(e) => patchPersonal(i, { cedula: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                {p.firma_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.firma_url} alt="firma" className="h-9 w-20 rounded border bg-white object-contain" />
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setSigTarget(i)}>
                  <PenLine className="size-4" /> {p.firma_url ? "Refirmar" : "Firmar"}
                </Button>
                <button onClick={() => removePersonal(i)} className="text-muted-foreground transition-colors hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* checklist */}
      <div className={card}>
        <div className={cardHead}>Lista de verificación de seguridad</div>
        <div className="divide-y">
          {checklist.map((sec, si) => (
            <div key={si} className="p-4">
              <p className="mb-2 text-sm font-medium text-[#0f2044]">{sec.seccion}</p>
              <div className="space-y-1.5">
                {sec.items.map((it, ii) => (
                  <button
                    key={ii}
                    onClick={() => cycleItem(si, ii)}
                    className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span
                      className={
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold " +
                        (it.cumple === true
                          ? "bg-emerald-100 text-emerald-700"
                          : it.cumple === false
                            ? "bg-red-100 text-red-700"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {it.cumple === true ? "✓ CUMPLE" : it.cumple === false ? "✗ NO" : "— N/A"}
                    </span>
                    <span className="min-w-0">{it.texto}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* autorización */}
      <div className={card}>
        <div className={cardHead}>Autorización</div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <SignerBlock
            title="Emisor"
            nombre={f.emisor_nombre}
            cedula={f.emisor_cedula}
            url={emisorFirma.url}
            onNombre={(v) => set("emisor_nombre", v)}
            onCedula={(v) => set("emisor_cedula", v)}
            onSign={() => setSigTarget("emisor")}
          />
          <SignerBlock
            title="Vigía SST"
            nombre={f.vigia_nombre}
            cedula={f.vigia_cedula}
            url={vigiaFirma.url}
            onNombre={(v) => set("vigia_nombre", v)}
            onCedula={(v) => set("vigia_cedula", v)}
            onSign={() => setSigTarget("vigia")}
          />
        </div>
        <div className="px-4 pb-4">
          <Field label="Observaciones">
            <textarea className={inp + " h-auto py-2"} rows={2} value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* diálogo de firma */}
      <Dialog.Root open={sigTarget !== null} onOpenChange={(o) => !o && setSigTarget(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            <Dialog.Title className="text-base font-semibold">Firma</Dialog.Title>
            <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
              Firma con el dedo. Queda registrada en el permiso.
            </Dialog.Description>
            <SignaturePad ref={padRef} className="mt-3 h-44 w-full rounded-lg border-2 border-dashed bg-white" />
            <div className="mt-3 flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => padRef.current?.clear()}>
                Limpiar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSigTarget(null)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveSignature} disabled={savingSig}>
                  {savingSig ? "Guardando…" : "Guardar firma"}
                </Button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SignerBlock({
  title,
  nombre,
  cedula,
  url,
  onNombre,
  onCedula,
  onSign,
}: {
  title: string;
  nombre: string;
  cedula: string;
  url: string;
  onNombre: (v: string) => void;
  onCedula: (v: string) => void;
  onSign: () => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2">
        <input className={inp} placeholder="Nombre" value={nombre} onChange={(e) => onNombre(e.target.value)} />
        <input className={inp} placeholder="Cédula" value={cedula} onChange={(e) => onCedula(e.target.value)} />
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Firma ${title}`} className="h-16 w-full rounded border bg-white object-contain" />
        ) : null}
        <Button variant="outline" size="sm" className="w-full" onClick={onSign}>
          <PenLine className="size-4" /> {url ? "Refirmar" : "Firmar"}
        </Button>
      </div>
    </div>
  );
}
