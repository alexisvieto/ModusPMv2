"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Camera, FileDown, PenLine, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/survey/signature-pad";
import { createClient } from "@/lib/supabase/client";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
const BUCKET = "survey-evidence";

type SurveyProps = {
  id: string;
  organization_id: string;
  client_name: string;
  project_name: string;
  site_location: string;
  survey_date: string;
  engineer_name: string;
  personnel: string;
  field_days: string;
  notes: string;
  status: string;
};
type Contact = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
};
type Finding = {
  id: string;
  title: string;
  description: string;
  severity: string;
};
type Photo = { id: string; caption: string; url: string; path: string };
type Signature = {
  id: string;
  signer_name: string;
  signer_role: string;
  signed_at: string;
  url: string;
  path: string;
};

const SEVERITY: { v: string; l: string; cls: string }[] = [
  { v: "baja", l: "Baja", cls: "bg-emerald-100 text-emerald-700" },
  { v: "media", l: "Media", cls: "bg-amber-100 text-amber-700" },
  { v: "alta", l: "Alta", cls: "bg-red-100 text-red-700" },
];

export function SurveyEditor({
  survey,
  initialContacts,
  initialFindings,
  initialPhotos,
  initialSignatures,
}: {
  survey: SurveyProps;
  initialContacts: Contact[];
  initialFindings: Finding[];
  initialPhotos: Photo[];
  initialSignatures: Signature[];
}) {
  const router = useRouter();
  const sb = createClient();
  const org = survey.organization_id;

  const [client, setClient] = useState(survey.client_name);
  const [project, setProject] = useState(survey.project_name);
  const [site, setSite] = useState(survey.site_location);
  const [date, setDate] = useState(survey.survey_date);
  const [engineer, setEngineer] = useState(survey.engineer_name);
  const [personnel, setPersonnel] = useState(survey.personnel);
  const [days, setDays] = useState(survey.field_days);
  const [notes, setNotes] = useState(survey.notes);
  const [status, setStatus] = useState(survey.status);
  const [saving, setSaving] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [findings, setFindings] = useState<Finding[]>(initialFindings);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [signatures, setSignatures] = useState<Signature[]>(initialSignatures);
  const [uploading, setUploading] = useState(false);

  // ───────── cabecera ─────────
  // finalize=true (botón Guardar): persiste y marca la inspección como lista.
  // finalize=false (blur de notas): guarda en silencio sin cambiar el estado.
  async function saveHeader(finalize: boolean) {
    setSaving(true);
    const base = {
      client_name: client.trim() || null,
      project_name: project.trim() || null,
      site_location: site.trim() || null,
      survey_date: date,
      engineer_name: engineer.trim() || null,
      personnel: parseInt(personnel) || 0,
      field_days: Number(days) || 0,
      notes: notes.trim() || null,
    };
    const patch = finalize ? { ...base, status: "completado" } : base;
    const { error } = await sb
      .from("survey_surveys")
      .update(patch)
      .eq("id", survey.id);
    setSaving(false);
    if (error) return toast.error("No se pudo guardar.");
    if (finalize) {
      setStatus("completado");
      toast.success("Guardado. Ya puedes exportar el PDF.");
    }
    router.refresh();
  }

  function exportPdf() {
    window.open(`/api/survey/${survey.id}/pdf`, "_blank");
  }

  // ───────── contactos ─────────
  async function addContact() {
    const { data, error } = await sb
      .from("survey_contacts")
      .insert({ survey_id: survey.id, organization_id: org, name: "" })
      .select("id")
      .maybeSingle();
    if (error || !data) return toast.error("No se pudo agregar el contacto.");
    setContacts((c) => [
      ...c,
      { id: data.id, name: "", role: "", phone: "", email: "", notes: "" },
    ]);
  }
  function patchContact(id: string, patch: Partial<Contact>) {
    setContacts((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  async function persistContact(c: Contact) {
    await sb
      .from("survey_contacts")
      .update({
        name: c.name.trim(),
        role: c.role.trim() || null,
        phone: c.phone.trim() || null,
        email: c.email.trim() || null,
        notes: c.notes.trim() || null,
      })
      .eq("id", c.id);
  }
  async function removeContact(id: string) {
    setContacts((c) => c.filter((x) => x.id !== id));
    await sb.from("survey_contacts").delete().eq("id", id);
  }

  // ───────── dificultades ─────────
  async function addFinding() {
    const { data, error } = await sb
      .from("survey_findings")
      .insert({
        survey_id: survey.id,
        organization_id: org,
        title: "",
        severity: "media",
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return toast.error("No se pudo agregar.");
    setFindings((f) => [
      ...f,
      { id: data.id, title: "", description: "", severity: "media" },
    ]);
  }
  function patchFinding(id: string, patch: Partial<Finding>) {
    setFindings((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  async function persistFinding(f: Finding) {
    await sb
      .from("survey_findings")
      .update({
        title: f.title.trim(),
        description: f.description.trim() || null,
        severity: f.severity,
      })
      .eq("id", f.id);
  }
  async function setFindingSeverity(f: Finding, severity: string) {
    patchFinding(f.id, { severity });
    await sb.from("survey_findings").update({ severity }).eq("id", f.id);
  }
  async function removeFinding(id: string) {
    setFindings((f) => f.filter((x) => x.id !== id));
    await sb.from("survey_findings").delete().eq("id", id);
  }

  // ───────── fotos ─────────
  async function onPickPhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${org}/${survey.id}/photos/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (up.error) {
        toast.error("No se pudo subir una foto.");
        continue;
      }
      const { data: row } = await sb
        .from("survey_photos")
        .insert({ survey_id: survey.id, organization_id: org, storage_path: path })
        .select("id")
        .maybeSingle();
      const { data: signed } = await sb.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600);
      if (row)
        setPhotos((p) => [
          ...p,
          { id: row.id, caption: "", url: signed?.signedUrl ?? "", path },
        ]);
    }
    setUploading(false);
  }
  function patchPhoto(id: string, caption: string) {
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, caption } : x)));
  }
  async function persistPhoto(ph: Photo) {
    await sb
      .from("survey_photos")
      .update({ caption: ph.caption.trim() || null })
      .eq("id", ph.id);
  }
  async function removePhoto(ph: Photo) {
    setPhotos((p) => p.filter((x) => x.id !== ph.id));
    await sb.from("survey_photos").delete().eq("id", ph.id);
    await sb.storage.from(BUCKET).remove([ph.path]);
  }

  // ───────── firmas ─────────
  const padRef = useRef<SignaturePadHandle>(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [savingSig, setSavingSig] = useState(false);

  function openSig() {
    setSignerName("");
    setSignerRole("");
    setSigOpen(true);
  }
  async function saveSignature() {
    if (savingSig) return;
    if (!signerName.trim()) return toast.error("Escribe quién firma.");
    if (padRef.current?.isEmpty()) return toast.error("La firma está vacía.");
    setSavingSig(true);
    const blob = await padRef.current?.toBlob();
    if (!blob) {
      setSavingSig(false);
      return toast.error("No se pudo capturar la firma.");
    }
    const path = `${org}/${survey.id}/signatures/${crypto.randomUUID()}.png`;
    const up = await sb.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/png" });
    if (up.error) {
      setSavingSig(false);
      return toast.error("No se pudo subir la firma.");
    }
    const { data: row } = await sb
      .from("survey_signatures")
      .insert({
        survey_id: survey.id,
        organization_id: org,
        signer_name: signerName.trim(),
        signer_role: signerRole.trim() || null,
        storage_path: path,
      })
      .select("id, signed_at")
      .maybeSingle();
    const { data: signed } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    setSavingSig(false);
    if (!row) return toast.error("No se pudo registrar la firma.");
    setSignatures((s) => [
      ...s,
      {
        id: row.id,
        signer_name: signerName.trim(),
        signer_role: signerRole.trim(),
        signed_at: row.signed_at,
        url: signed?.signedUrl ?? "",
        path,
      },
    ]);
    setSigOpen(false);
    toast.success("Firma registrada.");
  }
  async function removeSignature(s: Signature) {
    setSignatures((arr) => arr.filter((x) => x.id !== s.id));
    await sb.from("survey_signatures").delete().eq("id", s.id);
    await sb.storage.from(BUCKET).remove([s.path]);
  }

  const card = "rounded-xl border bg-card";
  const cardHead =
    "flex items-center justify-between gap-2 border-b px-4 py-2.5 text-sm font-semibold";

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      {/* barra */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {client || "Survey"}
          </h1>
          <p className="text-xs text-muted-foreground">{site || "Sin ubicación"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {status === "completado" ? "Completado" : "Borrador"}
          </span>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="size-4" /> Exportar PDF
          </Button>
          <Button size="sm" onClick={() => saveHeader(true)} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {/* datos generales */}
      <div className={card}>
        <div className={cardHead}>Datos de la inspección</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Cliente">
            <input className={inp} value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label="Proyecto">
            <input className={inp} value={project} onChange={(e) => setProject(e.target.value)} />
          </Field>
          <Field label="Sitio / ubicación">
            <input className={inp} value={site} onChange={(e) => setSite(e.target.value)} />
          </Field>
          <Field label="Fecha">
            <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Ingeniero">
            <input className={inp} value={engineer} onChange={(e) => setEngineer(e.target.value)} />
          </Field>
        </div>
        {/* personal y días — alimentan la cotización de Nexus */}
        <div className="grid gap-3 border-t bg-muted/30 p-4 sm:grid-cols-2">
          <Field label="Personal en campo (nº)">
            <input
              type="number"
              inputMode="numeric"
              className={inp}
              value={personnel}
              onChange={(e) => setPersonnel(e.target.value)}
            />
          </Field>
          <Field label="Días de campo">
            <input
              type="number"
              inputMode="decimal"
              className={inp}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Personal y días alimentan la mano de obra y el cronograma al crear la
            cotización en Nexus.
          </p>
        </div>
      </div>

      {/* contactos */}
      <div className={card}>
        <div className={cardHead}>
          <span>Contactos — con quién se habló</span>
          <Button variant="outline" size="sm" onClick={addContact}>
            <Plus className="size-4" /> Contacto
          </Button>
        </div>
        <div className="divide-y">
          {contacts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Sin contactos aún.</p>
          )}
          {contacts.map((c) => (
            <div key={c.id} className="grid gap-2 p-4 sm:grid-cols-2">
              <input
                className={inp}
                placeholder="Nombre"
                value={c.name}
                onChange={(e) => patchContact(c.id, { name: e.target.value })}
                onBlur={() => persistContact({ ...c })}
              />
              <input
                className={inp}
                placeholder="Cargo / rol"
                value={c.role}
                onChange={(e) => patchContact(c.id, { role: e.target.value })}
                onBlur={() => persistContact({ ...c })}
              />
              <input
                className={inp}
                placeholder="Teléfono"
                value={c.phone}
                onChange={(e) => patchContact(c.id, { phone: e.target.value })}
                onBlur={() => persistContact({ ...c })}
              />
              <input
                className={inp}
                placeholder="Correo"
                value={c.email}
                onChange={(e) => patchContact(c.id, { email: e.target.value })}
                onBlur={() => persistContact({ ...c })}
              />
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  className={inp}
                  placeholder="Notas"
                  value={c.notes}
                  onChange={(e) => patchContact(c.id, { notes: e.target.value })}
                  onBlur={() => persistContact({ ...c })}
                />
                <button
                  onClick={() => removeContact(c.id)}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* dificultades */}
      <div className={card}>
        <div className={cardHead}>
          <span>Dificultades y observaciones</span>
          <Button variant="outline" size="sm" onClick={addFinding}>
            <Plus className="size-4" /> Observación
          </Button>
        </div>
        <div className="divide-y">
          {findings.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Sin observaciones aún.
            </p>
          )}
          {findings.map((f) => (
            <div key={f.id} className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <input
                  className={inp}
                  placeholder="Título de la dificultad"
                  value={f.title}
                  onChange={(e) => patchFinding(f.id, { title: e.target.value })}
                  onBlur={() => persistFinding({ ...f })}
                />
                <button
                  onClick={() => removeFinding(f.id)}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <textarea
                className={inp + " h-auto py-2"}
                rows={2}
                placeholder="Detalle / cómo afecta el trabajo"
                value={f.description}
                onChange={(e) => patchFinding(f.id, { description: e.target.value })}
                onBlur={() => persistFinding({ ...f })}
              />
              <div className="flex gap-1.5">
                {SEVERITY.map((s) => (
                  <button
                    key={s.v}
                    onClick={() => setFindingSeverity(f, s.v)}
                    className={
                      "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors " +
                      (f.severity === s.v
                        ? s.cls
                        : "bg-muted text-muted-foreground hover:bg-muted/70")
                    }
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* fotos */}
      <div className={card}>
        <div className={cardHead}>
          <span>Fotos de evidencia</span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
            <Camera className="size-4" />
            {uploading ? "Subiendo…" : "Agregar"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => onPickPhotos(e.target.files)}
            />
          </label>
        </div>
        <div className="p-4">
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin fotos aún.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((ph) => (
                <div key={ph.id} className="space-y-1">
                  <div className="group relative overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ph.url}
                      alt={ph.caption || "Evidencia"}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(ph)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <input
                    className="h-7 w-full rounded border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                    placeholder="Descripción"
                    value={ph.caption}
                    onChange={(e) => patchPhoto(ph.id, e.target.value)}
                    onBlur={() => persistPhoto({ ...ph })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* firmas */}
      <div className={card}>
        <div className={cardHead}>
          <span>Firmas</span>
          <Button variant="outline" size="sm" onClick={openSig}>
            <PenLine className="size-4" /> Firmar
          </Button>
        </div>
        <div className="p-4">
          {signatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin firmas. El cliente que acompañó la inspección puede firmar en
              campo.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {signatures.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.signer_name}</p>
                      {s.signer_role && (
                        <p className="text-xs text-muted-foreground">{s.signer_role}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeSignature(s)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.url}
                    alt={`Firma de ${s.signer_name}`}
                    className="mt-2 h-20 w-full rounded border bg-white object-contain"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(s.signed_at).toLocaleString("es-PA")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* notas generales */}
      <div className={card}>
        <div className={cardHead}>Notas generales</div>
        <div className="p-4">
          <textarea
            className={inp + " h-auto py-2"}
            rows={4}
            placeholder="Resumen de la inspección, recomendaciones, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveHeader(false)}
          />
        </div>
      </div>

      {/* diálogo de firma */}
      <Dialog.Root open={sigOpen} onOpenChange={setSigOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
            <Dialog.Title className="text-base font-semibold">
              Firma en sitio
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
              Firma con el dedo. Queda registrada con nombre y fecha.
            </Dialog.Description>
            <div className="mt-4 space-y-3">
              <input
                className={inp}
                placeholder="Nombre de quien firma"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
              <input
                className={inp}
                placeholder="Cargo / relación (opcional)"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
              />
              <SignaturePad
                ref={padRef}
                className="h-44 w-full rounded-lg border-2 border-dashed bg-white"
              />
              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => padRef.current?.clear()}
                >
                  Limpiar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSigOpen(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveSignature} disabled={savingSig}>
                    {savingSig ? "Guardando…" : "Guardar firma"}
                  </Button>
                </div>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
