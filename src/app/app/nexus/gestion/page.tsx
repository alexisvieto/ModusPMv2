import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NexusManage } from "@/components/nexus/nexus-manage";
import { createClient } from "@/lib/supabase/server";

// Gestión de catálogo, categorías, divisiones y perfiles de M.O. (admin-only).
export default async function NexusGestionPage() {
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
  const orgId = membership?.organization_id ?? null;

  const { data: isAdmin } = orgId
    ? await supabase.rpc("has_org_role", { org: orgId, roles: ["owner", "admin"] })
    : { data: false };

  if (!orgId || !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Gestión</h1>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Solo un administrador puede gestionar el catálogo y las categorías.
        </div>
      </div>
    );
  }

  const [
    { data: divisions },
    { data: categories },
    { data: profiles },
    { data: catalog },
    { data: settings },
  ] = await Promise.all([
      supabase
        .from("nexus_divisions")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("nexus_categories")
        .select("id, name, color, division_id")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("nexus_labor_profiles")
        .select("id, name, daily_rate")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("nexus_catalog")
        .select("id, description, manufacturer, unit_price, division_id")
        .eq("organization_id", orgId)
        .order("description", { ascending: true }),
      supabase
        .from("nexus_settings")
        .select("review_teams_email")
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <div>
        <Link
          href="/app/nexus"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Cotizaciones
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Gestión</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de precios, categorías por división y perfiles de mano de obra.
        </p>
      </div>

      <NexusManage
        orgId={orgId}
        divisions={(divisions ?? []).map((d) => ({ id: d.id, name: d.name }))}
        categories={categories ?? []}
        profiles={(profiles ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          daily_rate: Number(p.daily_rate),
        }))}
        catalog={(catalog ?? []).map((c) => ({
          id: c.id,
          description: c.description,
          manufacturer: c.manufacturer,
          unit_price: Number(c.unit_price),
          division_id: c.division_id,
        }))}
        reviewEmail={settings?.review_teams_email ?? ""}
      />
    </div>
  );
}
