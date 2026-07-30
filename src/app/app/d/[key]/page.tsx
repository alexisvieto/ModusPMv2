import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { requireDepartment } from "@/lib/access";
import {
  DIVISION_ICON,
  DEFAULT_DIVISION_ICON,
  DIVISION_MODULES,
} from "@/lib/divisions";
import { createClient } from "@/lib/supabase/server";

// Home de una división: sus módulos + (próximamente) sus procesos/documentos ISO.
export default async function DivisionHome({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  // Guarda: exige pertenecer a esta división (bypass super-admin / dueño-admin).
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

  const { data: dept } = await supabase
    .from("departments")
    .select("name")
    .eq("organization_id", membership?.organization_id ?? "")
    .eq("key", key)
    .maybeSingle();
  if (!dept) notFound();

  const Icon = DIVISION_ICON[key] ?? DEFAULT_DIVISION_ICON;
  const modules = DIVISION_MODULES[key] ?? [];

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#0f2044] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(900px 500px at 15% -10%, rgba(247,154,2,0.12), transparent 60%), radial-gradient(1000px 600px at 100% 0%, rgba(26,52,96,0.9), transparent 55%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link
          href="/app"
          className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Portal
        </Link>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16">
        {/* Encabezado de la división */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Icon className="size-7" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
              División
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{dept.name}</h1>
          </div>
        </div>

        {/* Módulos de la división */}
        {modules.length > 0 && (
          <>
            <h2 className="mb-3 text-sm font-medium text-white/50">Módulos</h2>
            <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => {
                const MIcon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
                  >
                    <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                      <MIcon className="size-6" />
                    </div>
                    <div className="mt-4">
                      <h3 className="text-base font-semibold">{m.name}</h3>
                      <p className="mt-0.5 text-xs text-white/50">{m.tagline}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Procesos / Documentos ISO (siguiente fase) */}
        <h2 className="mb-3 text-sm font-medium text-white/50">
          Procesos y Documentos
        </h2>
        <div
          aria-disabled
          className="flex cursor-not-allowed items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <FileText className="size-6 text-white/50" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white/70">
              Formatos y procesos ISO
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                Próximamente
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-white/45">
              Automatización del Listado Maestro y los formatos de esta división.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
