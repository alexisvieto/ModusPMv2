import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Auto-seed de Nexus. Si la org del usuario aún no tiene config (0 divisiones),
// la siembra con los defaults del rubro (divisiones/categorías/perfiles/% +
// catálogo semilla por categoría). Se usa el service role porque la RPC
// `nexus_seed_org_defaults` está revocada a `authenticated` (solo server).
//
// Solo siembra la org que se le pasa —derivada de la membership del PROPIO
// usuario en la página— así que no hay riesgo cross-tenant. Es best-effort:
// cualquier fallo (p. ej. falta la service key en un entorno) se traga para no
// romper la carga de la home; el usuario simplemente vería Nexus sin sembrar.
export async function ensureNexusSeed(orgId: string): Promise<void> {
  if (!orgId) return;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("nexus_divisions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    if ((count ?? 0) > 0) return; // ya sembrada

    const admin = createAdminClient();
    const { error } = await admin.rpc("nexus_seed_org_defaults", {
      p_org: orgId,
    });
    if (error) console.error("[nexus] auto-seed falló:", error.message);
  } catch (e) {
    console.error("[nexus] auto-seed error:", e);
  }
}
