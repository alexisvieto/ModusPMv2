"use client";

import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

// Botón de cierre de sesión del panel de plataforma: permite salir del
// super-admin y volver a entrar (p. ej. como PM). Cliente porque signOut
// vive en el navegador (patrón idéntico al del portal).
export function AdminSignOut() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={signOut}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <LogOut className="size-4" />
      Cerrar sesión
    </button>
  );
}
