"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { emptyMinuta } from "@/lib/comercial/minuta";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  label: string;
  title: string;
  status: string;
  fecha: string;
  createdBy: string;
};

export function DocRecordsList({
  formatId,
  formatName,
  basePath,
  rows,
  newLabel = "Nuevo registro",
}: {
  formatId: string;
  formatName: string;
  basePath: string;
  rows: Row[];
  newLabel?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      r.title.toLowerCase().includes(s) || r.label.toLowerCase().includes(s)
    );
  });

  async function nuevo() {
    if (creating) return;
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("doc_create_record", {
      p_format: formatId,
      p_title: "",
      p_data: emptyMinuta(),
    });
    setCreating(false);
    const res = data as { id?: string } | null;
    if (error || !res?.id) {
      toast.error(error?.message ?? "No se pudo crear el registro.");
      return;
    }
    router.push(`${basePath}/${res.id}`);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente o nº…"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30"
          />
        </div>
        <Button onClick={nuevo} disabled={creating}>
          <Plus className="size-4" />
          {creating ? "Creando…" : newLabel}
        </Button>
      </div>

      {filtered.length > 0 ? (
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`${basePath}/${r.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-[#0f2044]/[0.06] text-[#0f2044]">
                <FileText className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.label}</span>
                  {r.status === "completado" ? (
                    <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                      Completado
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Borrador
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {r.title || "Sin cliente"}
                  {r.fecha ? ` · ${r.fecha}` : ""}
                  {r.createdBy ? ` · ${r.createdBy}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {q
            ? "Ningún registro coincide con la búsqueda."
            : `Aún no hay registros de "${formatName}". Crea el primero.`}
        </div>
      )}
    </main>
  );
}
