import Link from "next/link";
import { HardHat, MapPin } from "lucide-react";

import { NewPermitButton } from "@/components/hse/new-permit-button";
import { TIPO_PERMISOS, type PermitTypeKey } from "@/lib/hse/permits";
import { createClient } from "@/lib/supabase/server";

const ESTADO: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-amber-100 text-amber-700" },
  aprobado: { label: "Aprobado", cls: "bg-emerald-100 text-emerald-700" },
  rechazado: { label: "Rechazado", cls: "bg-red-100 text-red-700" },
  cerrado: { label: "Cerrado", cls: "bg-muted text-muted-foreground" },
};

export default async function HSEHome() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  const { data: permits } = orgId
    ? await supabase
        .from("hse_permits")
        .select(
          "id, permit_type, ubicacion, fecha, fecha_inicio, fecha_fin, estado",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Permisos de Trabajo
          </h1>
          <p className="text-sm text-muted-foreground">
            Permisos de alto riesgo con checklist y firmas en campo.
          </p>
        </div>
        {orgId && <NewPermitButton orgId={orgId} />}
      </div>

      {permits && permits.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {permits.map((p) => {
            const meta = TIPO_PERMISOS[p.permit_type as PermitTypeKey];
            const est = ESTADO[p.estado] ?? ESTADO.pendiente;
            return (
              <Link
                key={p.id}
                href={`/app/hse/${p.id}`}
                className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-[#0f2044]/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold leading-tight text-[#0f2044]">
                    <span className="text-lg">{meta?.icon ?? "📋"}</span>
                    {meta?.label ?? p.permit_type}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${est.cls}`}
                  >
                    {est.label}
                  </span>
                </div>
                {p.ubicacion && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{p.ubicacion}</span>
                  </span>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.fecha_inicio && p.fecha_fin
                    ? `${p.fecha_inicio} → ${p.fecha_fin}`
                    : (p.fecha ?? p.fecha_inicio ?? "—")}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <HardHat className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Aún no hay permisos. Crea el primero con “Nuevo permiso”.
          </p>
        </div>
      )}
    </div>
  );
}
