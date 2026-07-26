"use client";

import Link from "next/link";
import {
  Calculator,
  ClipboardList,
  FolderKanban,
  LogOut,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AppCard = {
  name: string;
  tagline: string;
  href: string;
  icon: typeof Calculator;
  enabled: boolean;
  badge?: string;
};

// Apps de la plataforma. La visibilidad por-tenant (feature flags) se afinará
// después; hoy los datos ya están aislados por RLS dentro de cada app.
const APPS: AppCard[] = [
  {
    name: "Nexus Cálculo",
    tagline: "Presupuestos y cotizaciones",
    href: "/app/nexus",
    icon: Calculator,
    enabled: true,
  },
  {
    name: "Nexus PM",
    tagline: "Gestión de proyectos",
    href: "/app/inicio",
    icon: FolderKanban,
    enabled: true,
  },
  {
    name: "Nexus Survey",
    tagline: "Levantamiento en sitio",
    href: "/app/survey",
    icon: ClipboardList,
    enabled: true,
  },
];

export function Portal({
  brandName,
  logoUrl,
  accent,
  userEmail,
}: {
  brandName: string;
  logoUrl: string | null;
  accent: string;
  userEmail: string | null;
}) {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const accentColor = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    accent,
  )
    ? accent
    : "#e8a020";

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#0f2044] text-white">
      {/* Halos sutiles de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(900px 500px at 15% -10%, rgba(247,154,2,0.12), transparent 60%), radial-gradient(1000px 600px at 100% 0%, rgba(26,52,96,0.9), transparent 55%)",
        }}
      />

      {/* Barra superior: solo usuario + salir */}
      <header className="relative z-10 flex items-center justify-end px-6 py-5">
        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="hidden text-xs text-white/50 sm:inline">
              {userEmail}
            </span>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-3.5" />
            Salir
          </button>
        </div>
      </header>

      {/* Contenido central: logo prominente + apps */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16">
        {/* Logo de la organización, en panel blanco para que resalte sobre navy */}
        <div className="mb-14 flex flex-col items-center">
          {logoUrl ? (
            <div className="rounded-2xl bg-white px-9 py-7 shadow-2xl shadow-black/40 ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={brandName}
                className="h-16 w-auto max-w-[360px] object-contain md:h-20"
              />
            </div>
          ) : (
            <div className="flex size-24 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <span className="font-mono text-4xl font-bold">
                {brandName.trim()[0]?.toUpperCase() ?? "M"}
              </span>
            </div>
          )}
          <p className="mt-6 text-sm text-white/45">
            Elige la aplicación con la que quieres trabajar
          </p>
        </div>

        {/* Tarjetas de apps */}
        <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          {APPS.map((app) => {
            const Icon = app.icon;
            const inner = (
              <>
                <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-6" />
                </div>
                <div className="mt-4">
                  <h2 className="text-base font-semibold">{app.name}</h2>
                  <p className="mt-0.5 text-xs text-white/50">{app.tagline}</p>
                </div>
                {app.badge && (
                  <span className="absolute right-4 top-4 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                    {app.badge}
                  </span>
                )}
              </>
            );

            const base =
              "group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left";

            return app.enabled ? (
              <Link
                key={app.name}
                href={app.href}
                className={cn(
                  base,
                  "transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-t-2xl opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ backgroundColor: accentColor }}
                />
                {inner}
              </Link>
            ) : (
              <div
                key={app.name}
                aria-disabled
                className={cn(base, "cursor-not-allowed opacity-50")}
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 pb-6 text-center text-xs text-white/25">
        {brandName} · plataforma multi-tenant
      </div>
    </div>
  );
}
