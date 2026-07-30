import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";

import { requireDepartment } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

// Chrome propio de Nexus (Cálculo de Proyectos): barra navy + volver al portal.
export default async function NexusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDepartment("comercial"); // división Comercial
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgName: string | null = null;
  if (user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membership) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", membership.organization_id)
        .maybeSingle();
      orgName = org?.name ?? null;
    }
  }

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-[#0f2044] px-4 text-white md:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Portal
          </Link>
          <span className="h-4 w-px bg-white/20" />
          {/* La marca lleva a la home del módulo = lista de Cotizaciones */}
          <Link
            href="/app/nexus"
            className="flex items-center gap-2 transition-colors hover:text-white/80"
          >
            <Calculator className="size-4 text-[#e8a020]" />
            <span className="text-sm font-semibold">Nexus Cálculo</span>
          </Link>
        </div>
        {orgName && <span className="text-xs text-white/50">{orgName}</span>}
      </header>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
