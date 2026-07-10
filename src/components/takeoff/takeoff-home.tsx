"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileScan,
  FileText,
  FileX2,
  Layers,
  Loader2,
  Plus,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SYSTEM_LABEL, SYSTEM_TYPES } from "@/lib/takeoff/catalog";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type System = Database["public"]["Tables"]["takeoff_systems"]["Row"];
type ScopeStatus = Database["public"]["Tables"]["takeoff_scope_status"]["Row"];
type ScopeDoc = Pick<
  Database["public"]["Tables"]["takeoff_scope_docs"]["Row"],
  | "id"
  | "doc_name"
  | "status"
  | "progress"
  | "page_count"
  | "project_title"
  | "contracting_entity"
  | "analyzed_at"
  | "created_at"
>;
type Project = { id: string; organization_id: string; name: string; code: string | null };

const selectCls =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring";

export function TakeoffHome({
  project,
  systems,
  scopeStatus,
  scopeDocs,
  profiles,
  currentUserId,
}: {
  project: Project;
  systems: System[];
  scopeStatus: ScopeStatus | null;
  scopeDocs: ScopeDoc[];
  profiles: { id: string; full_name: string | null }[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState<string | null>(null); // docId en proceso
  const [progress, setProgress] = useState<string | null>(null);
  const [newSystem, setNewSystem] = useState("");
  const [addingSystem, setAddingSystem] = useState(false);

  const nameOf = (id: string | null) =>
    profiles.find((p) => p.id === id)?.full_name ?? "—";

  const noPliego = scopeStatus?.status === "no_existe";

  // ── Bucle de análisis por lotes: el cliente pide "siguiente paso" hasta done ──
  async function runAnalysis(docId: string) {
    if (running) return;
    setRunning(docId);
    try {
      for (let i = 0; i < 200; i++) {
        const res = await fetch("/api/takeoff/scope-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scopeDocId: docId }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "El análisis falló.");
          break;
        }
        setProgress(json.progress ?? null);
        if (json.done) {
          toast.success("Pliego analizado.");
          break;
        }
      }
    } catch {
      toast.error("Error de red durante el análisis. Puedes continuar donde quedó.");
    } finally {
      setRunning(null);
      setProgress(null);
      router.refresh();
    }
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Sube el pliego en PDF.");
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      toast.error("El PDF supera 80 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const buf = await file.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Re-subida del mismo PDF: se reconoce por hash y se reutiliza.
      const { data: existing } = await supabase
        .from("takeoff_scope_docs")
        .select("id, doc_name, status")
        .eq("project_id", project.id)
        .eq("file_hash", hash)
        .maybeSingle();
      if (existing) {
        toast.info(
          existing.status === "analizado"
            ? `Este PDF ya fue analizado (“${existing.doc_name}”); se reutiliza el desglose.`
            : "Este PDF ya estaba en proceso; se continúa donde quedó.",
        );
        if (existing.status !== "analizado") await runAnalysis(existing.id);
        return;
      }

      const id = crypto.randomUUID();
      const path = `${project.organization_id}/${project.id}/${id}/pliego.pdf`;
      const up = await supabase.storage
        .from("takeoff-temp")
        .upload(path, file, { contentType: "application/pdf" });
      if (up.error) {
        toast.error("No se pudo subir el PDF.");
        return;
      }
      const { error } = await supabase.from("takeoff_scope_docs").insert({
        id,
        organization_id: project.organization_id,
        project_id: project.id,
        doc_name: file.name,
        file_hash: hash,
        status: "procesando",
        pdf_path: path,
        created_by: currentUserId,
      });
      if (error) {
        toast.error("No se pudo registrar el documento.");
        return;
      }
      await supabase.from("takeoff_scope_status").upsert({
        project_id: project.id,
        organization_id: project.organization_id,
        status: "pendiente",
        declared_by: null,
        declared_at: null,
      });
      await runAnalysis(id);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function declareNoPliego() {
    const supabase = createClient();
    const { error } = await supabase.from("takeoff_scope_status").upsert({
      project_id: project.id,
      organization_id: project.organization_id,
      status: "no_existe",
      declared_by: currentUserId,
      declared_at: new Date().toISOString(),
    });
    if (error) toast.error("No se pudo guardar.");
    else router.refresh();
  }

  async function revertNoPliego() {
    const supabase = createClient();
    const { error } = await supabase.from("takeoff_scope_status").upsert({
      project_id: project.id,
      organization_id: project.organization_id,
      status: "pendiente",
      declared_by: null,
      declared_at: null,
    });
    if (error) toast.error("No se pudo revertir.");
    else router.refresh();
  }

  async function addSystem() {
    if (!newSystem) return;
    setAddingSystem(true);
    const supabase = createClient();
    const { error } = await supabase.from("takeoff_systems").insert({
      organization_id: project.organization_id,
      project_id: project.id,
      system_type: newSystem,
      display_name: SYSTEM_LABEL[newSystem] ?? newSystem,
      source: "manual",
      sort_order: systems.length,
    });
    setAddingSystem(false);
    if (error) {
      toast.error("No se pudo agregar (¿ya existe ese sistema en el proyecto?).");
      return;
    }
    setNewSystem("");
    router.refresh();
  }

  const available = SYSTEM_TYPES.filter(
    (t) => !systems.some((s) => s.system_type === t.v),
  );

  return (
    <div className="space-y-6">
      {/* ── Pliego de cargos / Memorial ── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Pliego de cargos / Memorial</h2>
            </div>
            {!noPliego && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || !!running}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Subir pliego
                </Button>
                {scopeDocs.length === 0 && (
                  <Button size="sm" variant="outline" onClick={declareNoPliego}>
                    <FileX2 className="size-4" />
                    No existe pliego
                  </Button>
                )}
              </div>
            )}
          </div>

          {noPliego ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <span>
                Sin pliego — declarado por{" "}
                <span className="font-medium text-foreground">
                  {nameOf(scopeStatus?.declared_by ?? null)}
                </span>{" "}
                el {scopeStatus?.declared_at ? formatDate(scopeStatus.declared_at.slice(0, 10), { day: "2-digit", month: "long", year: "numeric" }) : "—"}
              </span>
              <Button size="sm" variant="ghost" onClick={revertNoPliego}>
                <Undo2 className="size-4" />
                Apareció el documento
              </Button>
            </div>
          ) : scopeDocs.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Es lo primero que estudia el ingeniero: sube el pliego y recibe el
              desglose completo (alcance, equipos, normas y panel de riesgos)
              antes de calcular nada.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {scopeDocs.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {d.project_title || d.doc_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.contracting_entity ? `${d.contracting_entity} · ` : ""}
                      {d.page_count ? `${d.page_count} págs · ` : ""}
                      {d.doc_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status === "analizado" && (
                      <Link
                        href={`/app/proyectos/${project.id}/calculo/pliego/${d.id}`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        Ver informe
                      </Link>
                    )}
                    {d.status !== "analizado" && running !== d.id && (
                      <Button size="sm" onClick={() => runAnalysis(d.id)}>
                        <FileScan className="size-4" />
                        {d.status === "error" ? "Reintentar análisis" : "Continuar análisis"}
                      </Button>
                    )}
                    {running === d.id && (
                      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        {progress ?? d.progress ?? "Analizando…"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sistemas del proyecto ── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Sistemas del proyecto</h2>
          {available.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className={selectCls}
                value={newSystem}
                onChange={(e) => setNewSystem(e.target.value)}
              >
                <option value="">Agregar sistema…</option>
                {available.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.l}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={addSystem} disabled={!newSystem || addingSystem}>
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>
          )}
        </div>

        {systems.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Sin sistemas aún. Se auto-sugieren al analizar el pliego, o agrégalos
            manualmente.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      <p className="text-sm font-medium">{s.display_name}</p>
                    </div>
                    {s.source === "pliego" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        del pliego
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-3 text-xs text-muted-foreground")}>
                    Sin iniciar — el análisis de planos de este sistema llega en
                    la fase 2 del módulo.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
