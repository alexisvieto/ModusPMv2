import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Perfiles de los miembros de UNA organización, siempre filtrados por tenant:
 * un usuario que pertenece a varias orgs nunca ve nombres de otra organización.
 */
export async function orgMemberProfiles(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<{ id: string; full_name: string | null }[]> {
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  return data ?? [];
}
