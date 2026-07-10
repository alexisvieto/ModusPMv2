import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";

// Área de super-admin de plataforma. El gate REAL vive aquí (servidor):
// si no es platform admin, ni se renderiza.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin", {});
  if (!isAdmin) redirect("/app");

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <span className="font-mono text-sm font-bold">M</span>
          </div>
          <span className="text-base font-semibold tracking-tight">
            Modus
            <span className="ml-1 font-mono font-medium text-primary">PM</span>
          </span>
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" />
            Plataforma
          </span>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a la app
        </Link>
      </header>
      <main className="min-w-0">{children}</main>
      <Toaster position="top-right" />
    </div>
  );
}
