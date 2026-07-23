import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { brandFromOrg, ORG_BRAND_COLUMNS, type OrgBranding } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, title")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

  // Super-admin de plataforma SIN organización propia: su lugar es /admin, no
  // /app (que quedaría vacío). Así `alexisvieto@` cae directo en el panel y
  // no se confunde con un miembro de tenant.
  if (isPlatformAdmin && !membership) redirect("/admin");

  let org: (OrgBranding & { id: string; slug: string }) | null = null;
  if (membership) {
    const { data } = await supabase
      .from("organizations")
      .select(`id, slug, ${ORG_BRAND_COLUMNS}`)
      .eq("id", membership.organization_id)
      .maybeSingle();
    org = data;
  }
  const brand = brandFromOrg(org);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, code, client_name, status")
    .eq(
      "organization_id",
      membership?.organization_id ?? "00000000-0000-0000-0000-000000000000",
    )
    .order("created_at", { ascending: true });

  return (
    <AppShell
      projects={projects ?? []}
      org={org}
      profile={profile}
      userEmail={user.email ?? null}
      brand={brand}
      isPlatformAdmin={!!isPlatformAdmin}
    >
      {children}
    </AppShell>
  );
}
