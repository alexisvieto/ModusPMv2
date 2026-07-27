"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2, FileDown, Mic, PenLine, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/ui/signature-pad";
import { createClient } from "@/lib/supabase/client";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
const BUCKET = "hse-evidence";

type EmpOpt = { id: string; nombre: string; cargo: string; division: string };
export type Asistencia = { empleado_id: string; nombre: string; firma_path: string | null };
export type Charla = {
  id: string;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  duracion_min: string;
  facilitador: string;
  lugar: string;
  descripcion: string;
  asistencias: Asistencia[];
};

type Draft = {
  titulo: string;
  fecha: string;
  hora_inicio: string;
  duracion_min: string;
  facilitador: string;
  lugar: string;
  descripcion: string;
};

function emptyDraft(facilitador: string): Draft {
  return {
    titulo: "",
    fecha: new Date().toISOString().split("T")[0],
    hora_inicio: "",
    duracion_min: "",
    facilitador,
    lugar: "",
    descripcion: "",
  };
}

export function CharlasBoard({
  orgId,
  empleados,
  userName,
  initial,
}: {
  orgId: string;
  empleados: EmpOpt[];
  userName: string;
  initial: Charla[];
}) {
  const sb = createClient();
  const [items, setItems] = useState<Charla[]>(initial);
  const [creating, setCreating] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [attId, setAttId] = useState<string | null>(null);

  const setC = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setCreating((p) => (p ? { ...p, [k]: v } : p));

  async function saveCharla() {
    if (!creating) return;
    if (!creating.titulo.trim()) return toast.error("El título es obligatorio.");
    setSaving(true);
    const { data: userRes } = await sb.auth.getUser();
    const { data, error } = await sb
      .from("hse_charlas")
      .insert({
        organization_id: orgId,
        titulo: creating.titulo.trim(),
        fecha: creating.fecha,
        hora_inicio: creating.hora_inicio.trim() || null,
        duracion_min: creating.duracion_min ? parseInt(creating.duracion_min) : null,
        facilitador: creating.facilitador.trim() || null,
        lugar: creating.lugar.trim() || null,
        descripcion: creating.descripcion.trim() || null,
        facilitador_id: userRes.user?.id ?? null,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) return toast.error("No se pudo crear la charla.");
    setItems((arr) => [
      {
        id: data.id,
        titulo: creating.titulo.trim(),
        fecha: creating.fecha,
        hora_inicio: creating.hora_inicio.trim(),
        duracion_min: creating.duracion_min,
        facilitador: creating.facilitador.trim(),
        lugar: creating.lugar.trim(),
        descripcion: creating.descripcion.trim(),
        asistencias: [],
      },
      ...arr,
    ]);
    setCreating(null);
    toast.success("Charla creada.");
  }

  const attCharla = items.find((c) => c.id === attId) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Charlas de seguridad</h1>
          <p className="text-sm text-muted-foreground">
            Charlas pre-tarea y toolbox con lista de asistencia firmada.
          </p>
        </div>
        <Button onClick={() => setCreating(emptyDraft(userName))}>
          <Plus className="size-4" /> Nueva charla
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Mic className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Sin charlas registradas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ch) => (
            <div key={ch.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight text-[#0f2044]">{ch.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      ch.fecha,
                      ch.hora_inicio,
                      ch.duracion_min ? `${ch.duracion_min} min` : "",
                      ch.lugar,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {ch.facilitador && (
                    <p className="text-xs text-muted-foreground">Facilitador: {ch.facilitador}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {ch.asistencias.length} firma{ch.asistencias.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setAttId(ch.id)}>
                  <PenLine className="size-4" /> Asistencia
                </Button>
                <a
                  href={`/api/hse/charlas/${ch.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <FileDown className="size-4" /> Acta PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* diálogo: nueva charla */}
      <Dialog.Root open={creating !== null} onOpenChange={(o) => !o && setCreating(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            <Dialog.Title className="text-base font-semibold">Nueva charla de seguridad</Dialog.Title>
            {creating && (
              <div className="mt-4 space-y-3">
                <div>
                  <Label>Título *</Label>
                  <input
                    className={inp}
                    value={creating.titulo}
                    onChange={(e) => setC("titulo", e.target.value)}
                    placeholder="Uso correcto de EPP, Trabajo en altura…"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha</Label>
                    <input
                      type="date"
                      className={inp}
                      value={creating.fecha}
                      onChange={(e) => setC("fecha", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Hora inicio</Label>
                    <input
                      type="time"
                      className={inp}
                      value={creating.hora_inicio}
                      onChange={(e) => setC("hora_inicio", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Duración (min)</Label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      className={inp}
                      value={creating.duracion_min}
                      onChange={(e) => setC("duracion_min", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Lugar</Label>
                    <input
                      className={inp}
                      value={creating.lugar}
                      onChange={(e) => setC("lugar", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Facilitador</Label>
                  <input
                    className={inp}
                    value={creating.facilitador}
                    onChange={(e) => setC("facilitador", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tema / descripción</Label>
                  <textarea
                    className={inp + " h-auto py-2"}
                    rows={2}
                    value={creating.descripcion}
                    onChange={(e) => setC("descripcion", e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreating(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveCharla} disabled={saving}>
                {saving ? "Guardando…" : "Crear charla"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* diálogo: asistencia (kiosco) */}
      <Dialog.Root open={attId !== null} onOpenChange={(o) => !o && setAttId(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            {attCharla && (
              <AttendancePanel
                orgId={orgId}
                empleados={empleados}
                charla={attCharla}
                onSigned={(a) =>
                  setItems((arr) =>
                    arr.map((c) =>
                      c.id === attCharla.id ? { ...c, asistencias: [...c.asistencias, a] } : c,
                    ),
                  )
                }
                onClose={() => setAttId(null)}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function AttendancePanel({
  orgId,
  empleados,
  charla,
  onSigned,
  onClose,
}: {
  orgId: string;
  empleados: EmpOpt[];
  charla: Charla;
  onSigned: (a: Asistencia) => void;
  onClose: () => void;
}) {
  const sb = createClient();
  const padRef = useRef<SignaturePadHandle>(null);
  const [saving, setSaving] = useState(false);

  const firmaron = new Set(charla.asistencias.map((a) => a.empleado_id));
  const pendientes = empleados.filter((e) => !firmaron.has(e.id));
  const current = pendientes[0] ?? null;

  async function confirmar() {
    if (!current || saving) return;
    if (padRef.current?.isEmpty()) return toast.error("La firma es obligatoria.");
    setSaving(true);
    const blob = await padRef.current?.toBlob();
    if (!blob) {
      setSaving(false);
      return toast.error("No se pudo capturar la firma.");
    }
    const path = `${orgId}/charlas/${charla.id}/${current.id}.png`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (up.error) {
      setSaving(false);
      return toast.error("No se pudo subir la firma.");
    }
    const { error } = await sb.from("hse_charla_asistencias").insert({
      organization_id: orgId,
      charla_id: charla.id,
      empleado_id: current.id,
      firma_path: path,
    });
    setSaving(false);
    if (error) return toast.error("No se pudo registrar la asistencia.");
    padRef.current?.clear();
    onSigned({ empleado_id: current.id, nombre: current.nombre, firma_path: path });
    if (pendientes.length === 1) toast.success("¡Todos firmaron!");
  }

  return (
    <div className="space-y-4">
      <Dialog.Title className="text-base font-semibold">Lista de asistencia</Dialog.Title>
      <p className="-mt-2 text-xs text-muted-foreground">{charla.titulo}</p>

      {charla.asistencias.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Firmaron ({charla.asistencias.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {charla.asistencias.map((a) => (
              <span
                key={a.empleado_id}
                className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
              >
                ✓ {a.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {current ? (
        <>
          <p className="text-xs text-muted-foreground">
            {pendientes.length} colaborador{pendientes.length !== 1 ? "es" : ""} pendiente
            {pendientes.length !== 1 ? "s" : ""}
          </p>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="font-semibold text-[#0f2044]">{current.nombre}</p>
            <p className="mb-2 text-xs text-muted-foreground">
              {[current.cargo, current.division].filter(Boolean).join(" · ")}
            </p>
            <SignaturePad
              ref={padRef}
              className="h-40 w-full rounded-lg border-2 border-dashed bg-white"
            />
            <button
              onClick={() => padRef.current?.clear()}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </button>
          </div>
          <Button className="w-full" onClick={confirmar} disabled={saving}>
            {saving
              ? "Guardando…"
              : pendientes.length > 1
                ? `✓ Confirmar y pasar al siguiente (${pendientes.length - 1} restante${pendientes.length - 1 !== 1 ? "s" : ""})`
                : "✓ Confirmar firma"}
          </Button>
        </>
      ) : (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 size-9 text-emerald-600" />
          <p className="font-semibold text-[#0f2044]">
            {empleados.length === 0 ? "No hay colaboradores" : "¡Asistencia completa!"}
          </p>
          <p className="text-xs text-muted-foreground">
            {empleados.length === 0
              ? "Registra colaboradores en Empleados para tomar asistencia."
              : "Todos los colaboradores firmaron."}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs text-muted-foreground">{children}</span>;
}
