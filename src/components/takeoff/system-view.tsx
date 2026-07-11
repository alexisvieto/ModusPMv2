"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileStack, Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type System = Database["public"]["Tables"]["takeoff_systems"]["Row"];
type Analysis = Database["public"]["Tables"]["takeoff_analyses"]["Row"] & {
  takeoff_sheets: { id: string; status: string }[];
};
type Project = { id: string; organization_id: string; name: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-muted text-muted-foreground" },
  procesando: { label: "Procesando", cls: "bg-primary/10 text-primary" },
  en_verificacion: { label: "En verificación", cls: "bg-warning/10 text-warning" },
  aprobado: { label: "Aprobado", cls: "bg-success/10 text-success" },
  error: { label: "Error", cls: "bg-destructive/10 text-destructive" },
};

export function SystemView({
  project,
  system,
  analyses,
  currentUserId,
}: {
  project: Project;
  system: System;
  analyses: Analysis[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [pendingAnalysisId, setPendingAnalysisId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Crea el análisis (cabecera) y abre el selector de hojas.
  async function createAnalysis() {
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("takeoff_analyses")
      .insert({
        organization_id: project.organization_id,
        system_id: system.id,
        system_type: system.system_type,
        name: name.trim() || `Análisis ${new Date().toISOString().slice(0, 10)}`,
        status: "borrador",
        created_by: currentUserId!,
      })
      .select("id")
      .maybeSingle();
    setCreating(false);
    if (error || !data) {
      toast.error("No se pudo crear el análisis.");
      return;
    }
    setPendingAnalysisId(data.id);
    setShowNew(false);
    setName("");
    fileRef.current?.click();
  }

  // Sube las hojas (PDF) a storage temporal y las registra; luego navega al
  // visor, que dispara el procesamiento de cada hoja pendiente.
  async function handleFiles(files: FileList) {
    const analysisId = pendingAnalysisId;
    if (!analysisId) return;
    const pdfs = [...files].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      toast.error("Sube las hojas en PDF.");
      return;
    }
    const supabase = createClient();
    let done = 0;
    for (const file of pdfs) {
      setUploadProgress(`Subiendo ${++done}/${pdfs.length}…`);
      const buf = await file.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const id = crypto.randomUUID();
      const path = `${project.organization_id}/${project.id}/sheets/${id}.pdf`;
      // Fila primero, upload después (sin huérfanos).
      const { error: insErr } = await supabase.from("takeoff_sheets").insert({
        id,
        organization_id: project.organization_id,
        analysis_id: analysisId,
        sheet_number: file.name.replace(/\.pdf$/i, "").slice(0, 60),
        file_hash: hash,
        file_name: file.name,
        status: "pendiente",
        pdf_path: path,
      });
      if (insErr) {
        toast.error(`No se pudo registrar ${file.name}.`);
        continue;
      }
      const up = await supabase.storage
        .from("takeoff-temp")
        .upload(path, file, { contentType: "application/pdf" });
      if (up.error) {
        await supabase.from("takeoff_sheets").delete().eq("id", id);
        toast.error(`No se pudo subir ${file.name}.`);
      }
    }
    setUploadProgress(null);
    setPendingAnalysisId(null);
    if (fileRef.current) fileRef.current.value = "";
    router.push(`/app/proyectos/${project.id}/calculo/analisis/${analysisId}`);
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/app/proyectos/${project.id}/calculo`}
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "-ml-2 mb-1")}
          >
            <ArrowLeft className="size-4" />
            Cálculo de planos
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            {system.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
        {uploadProgress ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {uploadProgress}
          </span>
        ) : (
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="size-4" />
            Crear análisis
          </Button>
        )}
      </div>

      {showNew && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre del análisis
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Análisis ${new Date().toISOString().slice(0, 10)}`}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
              />
            </div>
            <Button onClick={createAnalysis} disabled={creating}>
              <Upload className="size-4" />
              Crear y subir planos
            </Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      {analyses.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Sin análisis aún. Crea uno y sube las hojas del plano (5-15 típico) —
          el motor cuenta cada elemento y tú verificas.
        </p>
      ) : (
        <div className="space-y-2">
          {analyses.map((a) => {
            const sm = STATUS_META[a.status] ?? STATUS_META.borrador;
            const sheets = a.takeoff_sheets ?? [];
            return (
              <Link
                key={a.id}
                href={`/app/proyectos/${project.id}/calculo/analisis/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <FileStack className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sheets.length} {sheets.length === 1 ? "hoja" : "hojas"} ·{" "}
                      {formatDate(a.created_at.slice(0, 10), {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    sm.cls,
                  )}
                >
                  {sm.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
