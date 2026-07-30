"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { DIVISION_ICON, DEFAULT_DIVISION_ICON } from "@/lib/divisions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function Portal({
  brandName,
  logoUrl,
  accent,
  userEmail,
  divisions,
}: {
  brandName: string;
  logoUrl: string | null;
  accent: string;
  userEmail: string | null;
  divisions: { key: string; name: string }[];
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

      {/* Contenido central: logo prominente + divisiones */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16">
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
            {divisions.length > 0
              ? "Elige la división con la que quieres trabajar"
              : "Aún no tienes divisiones asignadas"}
          </p>
        </div>

        {/* Tarjetas de divisiones */}
        {divisions.length > 0 ? (
          <div
            className={cn(
              "grid w-full gap-4",
              divisions.length === 1
                ? "max-w-sm grid-cols-1"
                : divisions.length === 2
                  ? "max-w-2xl sm:grid-cols-2"
                  : "max-w-4xl sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {divisions.map((div) => {
              const Icon = DIVISION_ICON[div.key] ?? DEFAULT_DIVISION_ICON;
              return (
                <Link
                  key={div.key}
                  href={`/app/d/${div.key}`}
                  className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-t-2xl opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                    <Icon className="size-6" />
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                      División
                    </p>
                    <h2 className="text-lg font-semibold">{div.name}</h2>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="max-w-md rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-sm text-white/50">
            Habla con tu administrador para que te dé acceso a una división.
          </div>
        )}
      </div>

      <div className="relative z-10 pb-6 text-center text-xs text-white/25">
        {brandName} · plataforma multi-tenant
      </div>
    </div>
  );
}
