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
  const [
    { data: orgs },
    { data: members },
    { data: profiles },
    usersRes,
    { data: depts },
    { data: deptMembers },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "id, name, slug, legal_name, industry, created_at, seat_limit, price_per_seat, billing_currency, billable",
      )
      .order("created_at", { ascending: true }),
    admin
      .from("organization_members")
      .select("organization_id, user_id, role, status"),
    admin.from("profiles").select("id, full_name"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("departments")
      .select("id, organization_id, key, name, sort_order")
      .order("sort_order", { ascending: true }),
    admin.from("department_members").select("organization_id, department_id, user_id"),
  ]);

  // Mapa department_id -> key, para saber las divisiones de cada usuario.
  const deptKeyById = new Map((depts ?? []).map((d) => [d.id, d.key]));
  const userDeptKeys = new Map<string, string[]>(); // `${org}:${user}` -> keys
  for (const dm of deptMembers ?? []) {
    const k = `${dm.organization_id}:${dm.user_id}`;
    const key = deptKeyById.get(dm.department_id);
    if (!key) continue;
    userDeptKeys.set(k, [...(userDeptKeys.get(k) ?? []), key]);
  }

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
    industry: o.industry,
    createdAt: o.created_at,
    seatLimit: o.seat_limit,
    pricePerSeat: Number(o.price_per_seat ?? 0),
    billingCurrency: o.billing_currency,
    billable: o.billable,
    departments: (depts ?? [])
      .filter((d) => d.organization_id === o.id)
      .map((d) => ({ key: d.key, name: d.name })),
    members: (members ?? [])
      .filter((m) => m.organization_id === o.id)
      .map((m) => ({
        userId: m.user_id,
        role: m.role,
        status: m.status === "suspended" ? "suspended" : "active",
        email: emailById.get(m.user_id) ?? "",
        fullName: nameById.get(m.user_id) ?? "",
        departmentKeys: userDeptKeys.get(`${o.id}:${m.user_id}`) ?? [],
      })),
  }));

  return <AdminBoard orgs={rows} />;
}
