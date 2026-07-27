"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, FileDown, ImagePlus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
const BUCKET = "hse-evidence";

type Tipo = "accidente" | "incidente" | "cuasi_accidente";
type Sev = "leve" | "moderado" | "grave" | "fatal";
type Estado = "abierto" | "en_proceso" | "cerrado";

export type Incidente = {
  id: string;
  tipo_evento: Tipo;
  severidad: Sev;
  fecha_evento: string;
  hora_evento: string;
  ubicacion: string;
  descripcion: string;
  empleado_afectado: string | null;
  afectado_nombre: string | null;
  dias_perdidos: number;
  requirio_atencion_medica: boolean;
  causa_raiz: string;
  accion_correctiva: string;
  estado: Estado;
  fotos: string[];
  foto_urls: string[];
};

type EmpOpt = { id: string; nombre: string };

const TIPO_LABEL: Record<Tipo, string> = {
  accidente: "Accidente",
  incidente: "Incidente",
  cuasi_accidente: "Cuasi-accidente",
};
const TIPO_COLOR: Record<Tipo, string> = {
  accidente: "#DC2626",
  incidente: "#E8A020",
  cuasi_accidente: "#8a6500",
};
const SEV_LABEL: Record<Sev, string> = {
  leve: "Leve",
  moderado: "Moderado",
  grave: "Grave",
  fatal: "Fatal",
};
const SEV_COLOR: Record<Sev, string> = {
  leve: "#15803D",
  moderado: "#CA8A04",
  grave: "#E8A020",
  fatal: "#DC2626",
};
const ESTADO_LABEL: Record<Estado, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
};

type Pending = { file: File; preview: string };

type Draft = {
  id: string;
  tipo_evento: Tipo;
  severidad: Sev;
  fecha_evento: string;
  hora_evento: string;
  ubicacion: string;
  descripcion: string;
  empleado_afectado: string;
  dias_perdidos: string;
  requirio_atencion_medica: boolean;
  causa_raiz: string;
  accion_correctiva: string;
  estado: Estado;
  kept: { path: string; url: string }[];
};

function emptyDraft(): Draft {
  return {
    id: "",
    tipo_evento: "incidente",
    severidad: "leve",
    fecha_evento: new Date().toISOString().split("T")[0],
    hora_evento: "",
    ubicacion: "",
    descripcion: "",
    empleado_afectado: "",
    dias_perdidos: "0",
    requirio_atencion_medica: false,
    causa_raiz: "",
    accion_correctiva: "",
    estado: "abierto",
    kept: [],
  };
}

export function IncidentesBoard({
  orgId,
  empleados,
  initial,
}: {
  orgId: string;
  empleados: EmpOpt[];
  initial: Incidente[];
}) {
  const sb = createClient();
  const [items, setItems] = useState<Incidente[]>(initial);
  const [filtro, setFiltro] = useState<"todos" | Tipo>("todos");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const empById = new Map(empleados.map((e) => [e.id, e.nombre]));
  const filtered = filtro === "todos" ? items : items.filter((i) => i.tipo_evento === filtro);

  const setE = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setEditing((p) => (p ? { ...p, [k]: v } : p));

  // Cierra el editor liberando los object URLs de las fotos pendientes.
  function closeEditor() {
    pending.forEach((x) => URL.revokeObjectURL(x.preview));
    setPending([]);
    setEditing(null);
  }

  function openNew() {
    setEditing(emptyDraft());
  }
  function openEdit(i: Incidente) {
    setEditing({
      id: i.id,
      tipo_evento: i.tipo_evento,
      severidad: i.severidad,
      fecha_evento: i.fecha_evento,
      hora_evento: i.hora_evento,
      ubicacion: i.ubicacion,
      descripcion: i.descripcion,
      empleado_afectado: i.empleado_afectado ?? "",
      dias_perdidos: String(i.dias_perdidos),
      requirio_atencion_medica: i.requirio_atencion_medica,
      causa_raiz: i.causa_raiz,
      accion_correctiva: i.accion_correctiva,
      estado: i.estado,
      kept: i.fotos.map((path, idx) => ({ path, url: i.foto_urls[idx] ?? "" })),
    });
  }

  function pickFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPending((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }
  function dropPending(idx: number) {
    setPending((p) => {
      URL.revokeObjectURL(p[idx].preview);
      return p.filter((_, i) => i !== idx);
    });
  }
  function dropKept(path: string) {
    setEditing((p) => (p ? { ...p, kept: p.kept.filter((k) => k.path !== path) } : p));
  }

  async function save() {
    if (!editing) return;
    if (!editing.descripcion.trim()) return toast.error("La descripción es obligatoria.");
    setSaving(true);

    const base = {
      tipo_evento: editing.tipo_evento,
      severidad: editing.severidad,
      fecha_evento: editing.fecha_evento,
      hora_evento: editing.hora_evento.trim() || null,
      ubicacion: editing.ubicacion.trim() || null,
      descripcion: editing.descripcion.trim(),
      empleado_afectado: editing.empleado_afectado || null,
      dias_perdidos: parseInt(editing.dias_perdidos) || 0,
      requirio_atencion_medica: editing.requirio_atencion_medica,
      causa_raiz: editing.causa_raiz.trim() || null,
      accion_correctiva: editing.accion_correctiva.trim() || null,
      estado: editing.estado,
    };

    let id = editing.id;
    if (!id) {
      const { data: userRes } = await sb.auth.getUser();
      const { data, error } = await sb
        .from("hse_incidentes")
        .insert({ organization_id: orgId, ...base, reportado_por: userRes.user?.id ?? null })
        .select("id")
        .maybeSingle();
      if (error || !data) {
        setSaving(false);
        return toast.error("No se pudo registrar el incidente.");
      }
      id = data.id;
    } else {
      const { error } = await sb.from("hse_incidentes").update(base).eq("id", id);
      if (error) {
        setSaving(false);
        return toast.error("No se pudo guardar.");
      }
    }

    // Subir fotos nuevas.
    const newPaths: string[] = [];
    for (const { file } of pending) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${orgId}/incidentes/${id}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "image/jpeg",
      });
      if (up.error) toast.error("No se pudo subir una foto.");
      else newPaths.push(path);
    }

    const finalPaths = [...editing.kept.map((k) => k.path), ...newPaths];
    if (
      finalPaths.length !== editing.kept.length ||
      newPaths.length > 0 ||
      // en edición, si se borraron fotos también hay que persistir
      editing.id
    ) {
      await sb.from("hse_incidentes").update({ fotos: finalPaths }).eq("id", id);
    }

    // URLs firmadas para mostrar de inmediato.
    let signedUrls: string[] = [];
    if (finalPaths.length) {
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(finalPaths, 3600);
      signedUrls = (signed ?? []).map((s) => s.signedUrl ?? "");
    }

    const row: Incidente = {
      id,
      tipo_evento: base.tipo_evento,
      severidad: base.severidad,
      fecha_evento: base.fecha_evento,
      hora_evento: base.hora_evento ?? "",
      ubicacion: base.ubicacion ?? "",
      descripcion: base.descripcion,
      empleado_afectado: base.empleado_afectado,
      afectado_nombre: base.empleado_afectado ? (empById.get(base.empleado_afectado) ?? null) : null,
      dias_perdidos: base.dias_perdidos,
      requirio_atencion_medica: base.requirio_atencion_medica,
      causa_raiz: base.causa_raiz ?? "",
      accion_correctiva: base.accion_correctiva ?? "",
      estado: base.estado,
      fotos: finalPaths,
      foto_urls: signedUrls,
    };

    setItems((arr) => (editing.id ? arr.map((x) => (x.id === id ? row : x)) : [row, ...arr]));
    setSaving(false);
    const wasEdit = !!editing.id;
    closeEditor();
    toast.success(wasEdit ? "Incidente actualizado." : "Incidente registrado.");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidentes</h1>
          <p className="text-sm text-muted-foreground">
            Accidentes, incidentes y cuasi-accidentes con causa raíz y evidencia.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      {/* filtros */}
      <div className="flex gap-1.5 overflow-x-auto">
        {(["todos", "accidente", "incidente", "cuasi_accidente"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (filtro === f
                ? "bg-[#0f2044] text-white"
                : "bg-muted text-muted-foreground hover:text-foreground")
            }
          >
            {f === "todos" ? "Todos" : TIPO_LABEL[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Sin incidentes registrados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((i) => (
            <button
              key={i.id}
              onClick={() => openEdit(i)}
              className="block w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-[#0f2044]/30"
            >
              <div className="flex items-start justify-between gap-2">
                <Badge color={TIPO_COLOR[i.tipo_evento]}>{TIPO_LABEL[i.tipo_evento]}</Badge>
                <div className="flex shrink-0 gap-1.5">
                  <Badge color={SEV_COLOR[i.severidad]}>{SEV_LABEL[i.severidad]}</Badge>
                  <Badge color="#64748B">{ESTADO_LABEL[i.estado]}</Badge>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium">{i.descripcion}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[i.fecha_evento, i.ubicacion, i.afectado_nombre].filter(Boolean).join(" · ")}
              </p>
              {i.foto_urls.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {i.foto_urls.slice(0, 4).map(
                    (u, idx) =>
                      u && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={u}
                          alt=""
                          className="size-12 rounded-md border object-cover"
                        />
                      ),
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* diálogo */}
      <Dialog.Root open={editing !== null} onOpenChange={(o) => !o && closeEditor()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            <Dialog.Title className="text-base font-semibold">
              {editing?.id ? "Editar incidente" : "Registrar incidente"}
            </Dialog.Title>
            {editing && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <select
                      className={inp}
                      value={editing.tipo_evento}
                      onChange={(e) => setE("tipo_evento", e.target.value as Tipo)}
                    >
                      <option value="accidente">Accidente</option>
                      <option value="incidente">Incidente</option>
                      <option value="cuasi_accidente">Cuasi-accidente</option>
                    </select>
                  </div>
                  <div>
                    <Label>Severidad</Label>
                    <select
                      className={inp}
                      value={editing.severidad}
                      onChange={(e) => setE("severidad", e.target.value as Sev)}
                    >
                      <option value="leve">Leve</option>
                      <option value="moderado">Moderado</option>
                      <option value="grave">Grave</option>
                      <option value="fatal">Fatal</option>
                    </select>
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <input
                      type="date"
                      className={inp}
                      value={editing.fecha_evento}
                      onChange={(e) => setE("fecha_evento", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Hora</Label>
                    <input
                      type="time"
                      className={inp}
                      value={editing.hora_evento}
                      onChange={(e) => setE("hora_evento", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Ubicación</Label>
                  <input
                    className={inp}
                    value={editing.ubicacion}
                    onChange={(e) => setE("ubicacion", e.target.value)}
                    placeholder="Lugar del evento"
                  />
                </div>

                <div>
                  <Label>Descripción *</Label>
                  <textarea
                    className={inp + " h-auto py-2"}
                    rows={3}
                    value={editing.descripcion}
                    onChange={(e) => setE("descripcion", e.target.value)}
                    placeholder="Describe qué ocurrió…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Colaborador afectado</Label>
                    <select
                      className={inp}
                      value={editing.empleado_afectado}
                      onChange={(e) => setE("empleado_afectado", e.target.value)}
                    >
                      <option value="">— Ninguno / externo —</option>
                      {empleados.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Días perdidos</Label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      className={inp}
                      value={editing.dias_perdidos}
                      onChange={(e) => setE("dias_perdidos", e.target.value)}
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={editing.requirio_atencion_medica}
                    onChange={(e) => setE("requirio_atencion_medica", e.target.checked)}
                  />
                  Requirió atención médica
                </label>

                <div>
                  <Label>Causa raíz</Label>
                  <textarea
                    className={inp + " h-auto py-2"}
                    rows={2}
                    value={editing.causa_raiz}
                    onChange={(e) => setE("causa_raiz", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Acción correctiva</Label>
                  <textarea
                    className={inp + " h-auto py-2"}
                    rows={2}
                    value={editing.accion_correctiva}
                    onChange={(e) => setE("accion_correctiva", e.target.value)}
                  />
                </div>

                {editing.id && (
                  <div>
                    <Label>Estado</Label>
                    <select
                      className={inp}
                      value={editing.estado}
                      onChange={(e) => setE("estado", e.target.value as Estado)}
                    >
                      <option value="abierto">Abierto</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </div>
                )}

                {/* evidencia */}
                <div>
                  <Label>Evidencia fotográfica</Label>
                  <div className="flex flex-wrap gap-2">
                    {editing.kept.map((k) => (
                      <div key={k.path} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={k.url} alt="" className="size-16 rounded-md border object-cover" />
                        <button
                          type="button"
                          onClick={() => dropKept(k.path)}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                    {pending.map((p, idx) => (
                      <div key={idx} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.preview} alt="" className="size-16 rounded-md border object-cover" />
                        <button
                          type="button"
                          onClick={() => dropPending(idx)}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex size-16 items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:border-[#0f2044]/40 hover:text-foreground"
                    >
                      <ImagePlus className="size-5" />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => pickFiles(e.target.files)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {editing?.id && (
                <a
                  href={`/api/hse/incidentes/${editing.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mr-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <FileDown className="size-4" /> PDF
                </a>
              )}
              <Button variant="outline" size="sm" onClick={closeEditor}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : editing?.id ? "Actualizar" : "Registrar"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: color + "1a", color }}
    >
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs text-muted-foreground">{children}</span>;
}
