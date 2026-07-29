import Link from "next/link";
import { Blocks, Layers, Network, Settings, ShieldCheck, SlidersHorizontal, Wind, X, Zap, type LucideIcon } from "lucide-react";

import { NewEstimateButton } from "@/components/nexus/new-estimate-button";
import { ensureNexusSeed } from "@/lib/nexus/seed";
import { createClient } from "@/lib/supabase/server";

const NEXUS_STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  enviada: "Enviada",
};

// Ícono por división (por nombre; fallback genérico para otras orgs/divisiones).
function iconForDivision(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("mixto") || n.includes("mixta")) return Blocks;
  if (n.includes("especiales")) return ShieldCheck;
  if (n.includes("telecom") || n.includes("sistemas")) return Network;
  if (n.includes("hvac") || n.includes("aire") || n.includes("clima")) return Wind;
  if (n.includes("energy") || n.includes("energía") || n.includes("solar")) return Zap;
  return Layers;
}

// Home de Nexus: lista de cotizaciones (vacía al inicio) y las divisiones
// configuradas. Al hacer clic en una división se filtra la lista de arriba.
export default async function NexusHome({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>;
}) {
  const { division: activeDivision } = await searchParams;
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId =
    membership?.organization_id ?? "00000000-0000-0000-0000-000000000000";

  // Auto-seed: la primera vez que una org abre Nexus, siembra sus defaults
  // (divisiones/categorías/perfiles/% + catálogo por rubro). No-op si ya existe.
  if (membership?.organization_id) {
    await ensureNexusSeed(membership.organization_id);
  }

  let estimatesQuery = supabase
    .from("nexus_estimates")
    .select("id, name, client_name, odoo_code, estimate_date, total, status, version_no, division_id")
    .eq("organization_id", orgId)
    .eq("is_current", true)
    .order("created_at", { ascending: false });
  if (activeDivision) estimatesQuery = estimatesQuery.eq("division_id", activeDivision);

  const [{ data: estimates }, { data: divisions }] = await Promise.all([
    estimatesQuery,
    supabase
      .from("nexus_divisions")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true }),
  ]);

  const activeDivName = activeDivision
    ? ((divisions ?? []).find((d) => d.id === activeDivision)?.name ?? null)
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Presupuestos por categoría con exportable para gerencia.
          </p>
          {activeDivName && (
            <Link
              href="/app/nexus"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#0f2044]/8 px-2.5 py-1 text-xs font-medium text-[#0f2044] transition-colors hover:bg-[#0f2044]/15"
            >
              División: {activeDivName}
              <X className="size-3.5" />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/nexus/gestion"
            title="Gestión: catálogo, categorías, perfiles"
            className="inline-flex size-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SlidersHorizontal className="size-4" />
          </Link>
          <Link
            href="/app/nexus/config"
            title="Integración con Odoo"
            className="inline-flex size-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-4" />
          </Link>
          {membership && (
            <NewEstimateButton orgId={orgId} divisions={divisions ?? []} />
          )}
        </div>
      </div>

      {/* Lista de cotizaciones (vacía al inicio) */}
      {estimates && estimates.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Cotización</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Código Odoo</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2">
                    <Link
                      href={`/app/nexus/${e.id}`}
                      className="font-medium text-[#0f2044] hover:underline"
                    >
                      {e.name}
                    </Link>
                    {e.version_no > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        v{e.version_no}
                      </span>
                    )}
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {NEXUS_STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {e.client_name ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {e.odoo_code ? (
                      <span className="rounded bg-[#0f2044]/8 px-1.5 py-0.5 font-mono text-xs text-[#0f2044]">
                        {e.odoo_code}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {e.estimate_date}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {Number(e.total).toLocaleString("es-PA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {activeDivName
              ? `No hay cotizaciones en la división "${activeDivName}".`
              : "Aún no hay cotizaciones. La creación y el cálculo llegan en el siguiente paso."}
          </p>
        </div>
      )}

      {/* Divisiones (minimalista: solo la división + su ícono) */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Divisiones
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(divisions ?? []).map((d) => {
            const Icon = iconForDivision(d.name);
            const active = d.id === activeDivision;
            return (
              <Link
                key={d.id}
                href={active ? "/app/nexus" : `/app/nexus?division=${d.id}`}
                title={active ? "Quitar filtro" : `Filtrar cotizaciones de ${d.name}`}
                className={
                  "flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors " +
                  (active
                    ? "border-[#0f2044] ring-1 ring-[#0f2044]"
                    : "hover:border-[#0f2044]/30")
                }
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#0f2044]/8 text-[#0f2044]">
                  <Icon className="size-5.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    División{active ? " · filtrando" : ""}
                  </p>
                  <p className="font-semibold leading-tight">{d.name}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
