import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
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

  let org: { id: string; name: string; slug: string } | null = null;
  if (membership) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", membership.organization_id)
      .maybeSingle();
    org = data;
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, code, client_name, status")
    .order("created_at", { ascending: true });

  return (
    <AppShell
      projects={projects ?? []}
      org={org}
      profile={profile}
      userEmail={user.email ?? null}
    >
      {children}
    </AppShell>
  );
}
