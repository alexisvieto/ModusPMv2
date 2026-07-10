import { redirect } from "next/navigation";

import { AdminBoard, type OrgRow } from "@/components/admin/admin-board";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPage() {
  // Defensa en profundidad: además del layout, re-verificamos aquí porque
  // abajo usamos el cliente service-role (evade RLS).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/app");

  const admin = createAdminClient();
  const [{ data: orgs }, { data: members }, { data: profiles }, usersRes] =
    await Promise.all([
      admin
        .from("organizations")
        .select("id, name, slug, legal_name, created_at")
        .order("created_at", { ascending: true }),
      admin
        .from("organization_members")
        .select("organization_id, user_id, role"),
      admin.from("profiles").select("id, full_name"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  const emailById = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? ""]),
  );

  const rows: OrgRow[] = (orgs ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    legalName: o.legal_name,
    createdAt: o.created_at,
    members: (members ?? [])
      .filter((m) => m.organization_id === o.id)
      .map((m) => ({
        userId: m.user_id,
        role: m.role,
        email: emailById.get(m.user_id) ?? "",
        fullName: nameById.get(m.user_id) ?? "",
      })),
  }));

  return <AdminBoard orgs={rows} />;
}
