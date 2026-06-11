"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FlaskConical, Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FatsatEditorSheet,
  type EditablePoint,
} from "@/components/fatsat/fatsat-editor-sheet";
import {
  countResults,
  STATUS_META,
  TEMPLATES,
  TYPE_META,
  type FatsatResult,
  type FatsatType,
} from "@/lib/fatsat";
import { toISODate } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Protocol = Database["public"]["Tables"]["fatsat_protocols"]["Row"];
type Point = Database["public"]["Tables"]["fatsat_points"]["Row"];
type ProtocolWithPoints = Protocol & { fatsat_points: Point[] };
type Equipment = {
  id: string;
  description: string;
  brand_model: string | null;
  serial_number: string | null;
};
type Project = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  client_name: string | null;
};

function toEditable(points: Point[]): EditablePoint[] {
  return points
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      section: p.section,
      description: p.description,
      expected_result: p.expected_result,
      actual_result: p.actual_result,
      result: p.result,
      notes: p.notes,
    }));
}

export function FatsatBoard({
  project,
  protocols,
  equipment,
}: {
  project: Project;
  protocols: ProtocolWithPoints[];
  equipment: Equipment[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Protocol | null>(null);
  const [editingPoints, setEditingPoints] = useState<EditablePoint[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`fatsat-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fatsat_protocols",
          filter: `project_id=eq.${project.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, router]);

  function openProtocol(p: ProtocolWithPoints) {
    setEditing(p);
    setEditingPoints(toEditable(p.fatsat_points ?? []));
    setOpen(true);
  }

  async function create(type: FatsatType) {
    if (creating) return;
    setCreating(true);
    const supabase = createClient();
    const nums = protocols
      .filter((p) => p.type === type)
      .map((p) => {
        const m = p.code?.match(/(\d+)\s*$/);
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    const code = `${type.toUpperCase()}-${String(next).padStart(3, "0")}`;

    const { data, error } = await supabase
      .from("fatsat_protocols")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        type,
        code,
        protocol_date: toISODate(new Date()),
        status: "draft",
      })
      .select()
      .maybeSingle();
    if (error || !data) {
      setCreating(false);
      toast.error("No se pudo crear el protocolo.");
      return;
    }

    const { error: pErr } = await supabase.from("fatsat_points").insert(
      TEMPLATES[type].map((t, i) => ({
        organization_id: project.organization_id,
        protocol_id: data.id,
        sort_order: i + 1,
        section: t.section,
        description: t.description,
        expected_result: t.expected_result,
        result: "pending" as FatsatResult,
      })),
    );
    if (pErr) toast.error("Protocolo creado, pero no se cargó la plantilla.");

    const { data: fresh } = await supabase
      .from("fatsat_points")
      .select("*")
      .eq("protocol_id", data.id)
      .order("sort_order");
    setCreating(false);
    router.refresh();
    openProtocol({ ...data, fatsat_points: fresh ?? [] });
  }

  const sorted = useMemo(
    () =>
      protocols
        .slice()
        .sort((a, b) => b.protocol_date.localeCompare(a.protocol_date)),
    [protocols],
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {protocols.length} {protocols.length === 1 ? "protocolo" : "protocolos"}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={creating}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4" />
            Nuevo protocolo
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => create("fat")}>
              <FlaskConical className="size-4 text-primary" />
              <div className="flex flex-col">
                <span>FAT</span>
                <span className="text-xs text-muted-foreground">
                  Pruebas en fábrica
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => create("sat")}>
              <FlaskConical className="size-4 text-primary" />
              <div className="flex flex-col">
                <span>SAT</span>
                <span className="text-xs text-muted-foreground">
                  Pruebas en sitio
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((p) => {
          const c = countResults(p.fatsat_points ?? []);
          const pct = c.total ? Math.round((c.pass / c.total) * 100) : 0;
          const sm = STATUS_META[p.status];
          return (
            <button
              key={p.id}
              onClick={() => openProtocol(p)}
              className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      {TYPE_META[p.type].label}
                    </span>
                    <span className="font-medium">{p.code ?? "—"}</span>
                  </div>
                  <p className="mt-1 truncate text-sm">
                    {p.equipment_name ?? "Sin equipo"}
                    {p.tag ? ` · ${p.tag}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.protocol_date)}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    sm.className,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", sm.dot)} />
                  {sm.label}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {c.pass}/{c.total} aprobados
                  </span>
                  <span className="flex gap-2">
                    {c.fail > 0 && (
                      <span className="text-destructive">{c.fail} falla(s)</span>
                    )}
                    {c.pending > 0 && <span>{c.pending} pend.</span>}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}

        {protocols.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-sm text-muted-foreground">
            Aún no hay protocolos FAT/SAT.
            <Button size="sm" onClick={() => create("fat")} disabled={creating}>
              <Plus className="size-4" />
              Crear el primero (FAT)
            </Button>
          </div>
        )}
      </div>

      <FatsatEditorSheet
        protocol={editing}
        initialPoints={editingPoints}
        project={{
          name: project.name,
          code: project.code,
          client_name: project.client_name,
        }}
        equipment={equipment}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
