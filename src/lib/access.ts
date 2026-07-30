// =========================================================
// Acceso por división (departamento). El servidor es la seguridad:
//  - getMyDepartments(): las divisiones que el usuario ve en el portal.
//  - requireDepartment(key): guarda para el layout de cada módulo.
// Bypass para super-admin de plataforma y dueño/admin de la org (ven todo).
// =========================================================

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type Department = {
  id: string;
  key: string;
  name: string;
  sort_order: number;
};

/** Divisiones visibles para el usuario actual (para el portal). */
export async function getMyDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return [];
  const org = membership.organization_id;

  const { data: depts } = await supabase
    .from("departments")
    .select("id, key, name, sort_order")
    .eq("organization_id", org)
    .order("sort_order", { ascending: true });
  const all = depts ?? [];
  if (!all.length) return [];

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  const seesAll =
    !!isAdmin || membership.role === "owner" || membership.role === "admin";
  if (seesAll) return all;

  const { data: mine } = await supabase
    .from("department_members")
    .select("department_id")
    .eq("user_id", user.id)
    .eq("organization_id", org);
  const ids = new Set((mine ?? []).map((m) => m.department_id));
  return all.filter((d) => ids.has(d.id));
}

/**
 * Guarda de módulo: exige que el usuario pertenezca a la división `key`.
 * Redirige al portal si no tiene acceso. Úsalo al tope del layout del módulo.
 */
export async function requireDepartment(key: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // Super-admin de plataforma sin org → su lugar es /admin.
  if (!membership) {
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (isAdmin) return;
    redirect("/app");
  }

  // has_department_access ya hace el bypass de super-admin / dueño-admin.
  const { data: ok } = await supabase.rpc("has_department_access", {
    p_org: membership.organization_id,
    p_dept_key: key,
  });
  if (!ok) redirect("/app");
}
