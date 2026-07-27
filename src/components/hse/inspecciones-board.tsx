"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { FileDown, ImagePlus, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
const BUCKET = "hse-evidence";

type Riesgo = "bajo" | "medio" | "alto" | "critico";
type Estado = "abierto" | "en_proceso" | "cerrado";

export type Inspeccion = {
  id: string;
  fecha: string;
  ubicacion: string;
  tipo_inspeccion: string;
  hallazgo: string;
  riesgo: Riesgo;
  accion_requerida: string;
  responsable: string;
  fecha_limite: string;
  estado: Estado;
  fotos: string[];
  foto_urls: string[];
};

const RIESGO_LABEL: Record<Riesgo, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  critico: "Crítico",
};
const RIESGO_COLOR: Record<Riesgo, string> = {
  bajo: "#15803D",
  medio: "#CA8A04",
  alto: "#E8A020",
  critico: "#DC2626",
};
const ESTADO_LABEL: Record<Estado, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
};

type Pending = { file: File; preview: string };

type Draft = {
  id: string;
  fecha: string;
  ubicacion: string;
  tipo_inspeccion: string;
  hallazgo: string;
  riesgo: Riesgo;
  accion_requerida: string;
  responsable: string;
  fecha_limite: string;
  estado: Estado;
  kept: { path: string; url: string }[];
};

function emptyDraft(): Draft {
  return {
    id: "",
    fecha: new Date().toISOString().split("T")[0],
    ubicacion: "",
    tipo_inspeccion: "",
    hallazgo: "",
    riesgo: "medio",
    accion_requerida: "",
    responsable: "",
    fecha_limite: "",
    estado: "abierto",
    kept: [],
  };
}

export function InspeccionesBoard({
  orgId,
  initial,
}: {
  orgId: string;
  initial: Inspeccion[];
}) {
  const sb = createClient();
  const [items, setItems] = useState<Inspeccion[]>(initial);
  const [filtro, setFiltro] = useState<"todos" | Estado>("todos");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = filtro === "todos" ? items : items.filter((i) => i.estado === filtro);

  const setE = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setEditing((p) => (p ? { ...p, [k]: v } : p));

  function closeEditor() {
    pending.forEach((x) => URL.revokeObjectURL(x.preview));
    setPending([]);
    setEditing(null);
  }

  function openNew() {
    setEditing(emptyDraft());
  }
  function openEdit(i: Inspeccion) {
    setEditing({
      id: i.id,
      fecha: i.fecha,
      ubicacion: i.ubicacion,
      tipo_inspeccion: i.tipo_inspeccion,
      hallazgo: i.hallazgo,
      riesgo: i.riesgo,
      accion_requerida: i.accion_requerida,
      responsable: i.responsable,
      fecha_limite: i.fecha_limite,
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
    if (!editing.hallazgo.trim()) return toast.error("El hallazgo es obligatorio.");
    setSaving(true);

    const base = {
      fecha: editing.fecha,
      ubicacion: editing.ubicacion.trim() || null,
      tipo_inspeccion: editing.tipo_inspeccion.trim() || null,
      hallazgo: editing.hallazgo.trim(),
      riesgo: editing.riesgo,
      accion_requerida: editing.accion_requerida.trim() || null,
      responsable: editing.responsable.trim() || null,
      fecha_limite: editing.fecha_limite || null,
      estado: editing.estado,
    };

    let id = editing.id;
    if (!id) {
      const { data: userRes } = await sb.auth.getUser();
      const { data, error } = await sb
        .from("hse_inspecciones")
        .insert({ organization_id: orgId, ...base, inspector_id: userRes.user?.id ?? null })
        .select("id")
        .maybeSingle();
      if (error || !data) {
        setSaving(false);
        return toast.error("No se pudo registrar el hallazgo.");
      }
      id = data.id;
    } else {
      const { error } = await sb.from("hse_inspecciones").update(base).eq("id", id);
      if (error) {
        setSaving(false);
        return toast.error("No se pudo guardar.");
      }
    }

    const newPaths: string[] = [];
    for (const { file } of pending) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${orgId}/inspecciones/${id}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "image/jpeg",
      });
      if (up.error) toast.error("No se pudo subir una foto.");
      else newPaths.push(path);
    }

    const finalPaths = [...editing.kept.map((k) => k.path), ...newPaths];
    if (newPaths.length > 0 || editing.id) {
      await sb.from("hse_inspecciones").update({ fotos: finalPaths }).eq("id", id);
    }

    let signedUrls: string[] = [];
    if (finalPaths.length) {
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(finalPaths, 3600);
      signedUrls = (signed ?? []).map((s) => s.signedUrl ?? "");
    }

    const row: Inspeccion = {
      id,
      fecha: base.fecha,
      ubicacion: base.ubicacion ?? "",
      tipo_inspeccion: base.tipo_inspeccion ?? "",
      hallazgo: base.hallazgo,
      riesgo: base.riesgo,
      accion_requerida: base.accion_requerida ?? "",
      responsable: base.responsable ?? "",
      fecha_limite: base.fecha_limite ?? "",
      estado: base.estado,
      fotos: finalPaths,
      foto_urls: signedUrls,
    };

    setItems((arr) => (editing.id ? arr.map((x) => (x.id === id ? row : x)) : [row, ...arr]));
    setSaving(false);
    const wasEdit = !!editing.id;
    closeEditor();
    toast.success(wasEdit ? "Hallazgo actualizado." : "Hallazgo registrado.");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inspecciones</h1>
          <p className="text-sm text-muted-foreground">
            Hallazgos de campo con nivel de riesgo, acción requerida y seguimiento.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      {/* filtros por estado */}
      <div className="flex gap-1.5 overflow-x-auto">
        {(["todos", "abierto", "en_proceso", "cerrado"] as const).map((f) => (
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
            {f === "todos" ? "Todos" : ESTADO_LABEL[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Search className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Sin inspecciones registradas.</p>
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
                <Badge color={RIESGO_COLOR[i.riesgo]}>{RIESGO_LABEL[i.riesgo]}</Badge>
                <Badge color="#64748B">{ESTADO_LABEL[i.estado]}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium">{i.hallazgo}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  i.fecha,
                  i.tipo_inspeccion,
                  i.ubicacion,
                  i.responsable ? `Resp: ${i.responsable}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
              {editing?.id ? "Actualizar hallazgo" : "Nuevo hallazgo"}
            </Dialog.Title>
            {editing && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha</Label>
                    <input
                      type="date"
                      className={inp}
                      value={editing.fecha}
                      onChange={(e) => setE("fecha", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nivel de riesgo</Label>
                    <select
                      className={inp}
                      value={editing.riesgo}
                      onChange={(e) => setE("riesgo", e.target.value as Riesgo)}
                    >
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                      <option value="critico">Crítico</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label>Ubicación</Label>
                  <input
                    className={inp}
                    value={editing.ubicacion}
                    onChange={(e) => setE("ubicacion", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Tipo de inspección</Label>
                  <input
                    className={inp}
                    value={editing.tipo_inspeccion}
                    onChange={(e) => setE("tipo_inspeccion", e.target.value)}
                    placeholder="Orden y limpieza, EPP, Eléctrico…"
                  />
                </div>

                <div>
                  <Label>Hallazgo *</Label>
                  <textarea
                    className={inp + " h-auto py-2"}
                    rows={3}
                    value={editing.hallazgo}
                    onChange={(e) => setE("hallazgo", e.target.value)}
                    placeholder="Describe la condición observada…"
                  />
                </div>

                <div>
                  <Label>Acción requerida</Label>
                  <textarea
                    className={inp + " h-auto py-2"}
                    rows={2}
                    value={editing.accion_requerida}
                    onChange={(e) => setE("accion_requerida", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Responsable</Label>
                    <input
                      className={inp}
                      value={editing.responsable}
                      onChange={(e) => setE("responsable", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Fecha límite</Label>
                    <input
                      type="date"
                      className={inp}
                      value={editing.fecha_limite}
                      onChange={(e) => setE("fecha_limite", e.target.value)}
                    />
                  </div>
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
                  href={`/api/hse/inspecciones/${editing.id}/pdf`}
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
