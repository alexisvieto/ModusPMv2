import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Gate delgado de /app: solo autenticación. El chrome del PM (AppShell) vive en
// (pm)/layout.tsx; el portal y Nexus traen su propio layout. Así /app puede ser
// el portal (navy, tarjetas) sin quedar envuelto en la navegación del PM.
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

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

  // Super-admin de plataforma SIN organización: su lugar es /admin, no el portal
  // (que quedaría vacío). Así `alexisvieto@` cae directo en el panel.
  if (isPlatformAdmin && !membership) redirect("/admin");

  return <>{children}</>;
}
