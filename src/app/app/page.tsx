import { Portal } from "@/components/portal/portal";
import { brandFromOrg, ORG_BRAND_COLUMNS } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

// Portal post-login: logo de la organización prominente al centro y, debajo,
// una tarjeta por app. Multi-tenant (cada app aísla por RLS); el portal enruta.
export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // el layout ya redirige a /login

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let brandName = "Modus PM";
  let logoUrl: string | null = null;
  let accent = "#e8a020";
  if (membership) {
    const { data: org } = await supabase
      .from("organizations")
      .select(ORG_BRAND_COLUMNS)
      .eq("id", membership.organization_id)
      .maybeSingle();
    const brand = brandFromOrg(org);
    brandName = brand.name;
    logoUrl = brand.logoUrl;
    accent = brand.primary;
  }

  return (
    <Portal
      brandName={brandName}
      logoUrl={logoUrl}
      accent={accent}
      userEmail={user.email ?? null}
    />
  );
}
