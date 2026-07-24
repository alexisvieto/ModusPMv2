import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { OdooConfigForm } from "@/components/nexus/odoo-config-form";
import { createClient } from "@/lib/supabase/server";

// Configuración de la integración con Odoo (admin-only).
export default async function NexusConfigPage() {
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

  const { data: cfg } = orgId
    ? await supabase
        .from("nexus_odoo_config")
        .select("url, db, login, default_product_id, api_key_set, is_enabled")
        .eq("organization_id", orgId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      <div>
        <Link
          href="/app/nexus"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Cotizaciones
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Integración con Odoo</h1>
        <p className="text-sm text-muted-foreground">
          Conectá tu Odoo para enviar el cálculo a la cotización (por su código
          S00XXX) y crear las líneas automáticamente.
        </p>
      </div>

      {!orgId ? (
        <p className="text-sm text-muted-foreground">Sin organización.</p>
      ) : !isAdmin ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Solo un administrador de la organización puede configurar la conexión
          con Odoo.
        </div>
      ) : (
        <OdooConfigForm
          orgId={orgId}
          config={{
            url: cfg?.url ?? "",
            db: cfg?.db ?? "",
            login: cfg?.login ?? "",
            default_product_id: cfg?.default_product_id ?? null,
            api_key_set: cfg?.api_key_set ?? false,
            is_enabled: cfg?.is_enabled ?? false,
          }}
        />
      )}
    </div>
  );
}
