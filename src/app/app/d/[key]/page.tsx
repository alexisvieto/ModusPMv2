import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, FileText } from "lucide-react";

import { requireDepartment } from "@/lib/access";
import {
  DIVISION_ICON,
  DEFAULT_DIVISION_ICON,
  DIVISION_MODULES,
} from "@/lib/divisions";
import { createClient } from "@/lib/supabase/server";

// Home de una división: espacio de trabajo integrado (sin tarjetas decorativas).
// Herramientas (módulos) + Documentos y formatos (registros ISO de la división).
export default async function DivisionHome({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  await requireDepartment(key);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .maybeSingle();
  const org = membership?.organization_id ?? "";

  const { data: dept } = await supabase
    .from("departments")
    .select("name")
    .eq("organization_id", org)
    .eq("key", key)
    .maybeSingle();
  if (!dept) notFound();

  const [{ data: formats }, { data: recRows }] = await Promise.all([
    supabase
      .from("doc_formats")
      .select("id, code, name")
      .eq("organization_id", org)
      .eq("department_key", key)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("doc_records")
      .select("format_id")
      .eq("organization_id", org)
      .eq("department_key", key),
  ]);

  const countByFormat = new Map<string, number>();
  for (const r of recRows ?? [])
    countByFormat.set(r.format_id, (countByFormat.get(r.format_id) ?? 0) + 1);

  const Icon = DIVISION_ICON[key] ?? DEFAULT_DIVISION_ICON;
  const modules = DIVISION_MODULES[key] ?? [];

  return (
    <div className="min-h-svh bg-muted/20">
      {/* Barra navy: volver al portal + nombre de la división */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-[#0f2044] px-4 text-white md:px-6">
        <Link
          href="/app"
          className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Portal
        </Link>
        <span className="h-4 w-px bg-white/20" />
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-[#e8a020]" />
          <span className="text-sm font-semibold">{dept.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 p-6 md:p-8">
        {/* Herramientas (módulos) */}
        {modules.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Herramientas
            </h2>
            <div className="divide-y overflow-hidden rounded-lg border bg-card">
              {modules.map((m) => {
                const MIcon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-9 items-center justify-center rounded-md bg-[#0f2044]/[0.06] text-[#0f2044]">
                      <MIcon className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.tagline}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Documentos y formatos (registros ISO) */}
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documentos y formatos
          </h2>
          {formats && formats.length > 0 ? (
            <div className="divide-y overflow-hidden rounded-lg border bg-card">
              {formats.map((f) => {
                const n = countByFormat.get(f.id) ?? 0;
                return (
                  <Link
                    key={f.id}
                    href={`/app/d/${key}/doc/${f.code}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-9 items-center justify-center rounded-md bg-[#0f2044]/[0.06] text-[#0f2044]">
                      <FileText className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{f.name}</p>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {f.code}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {n} {n === 1 ? "registro" : "registros"}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aún no hay formatos configurados en esta división.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
