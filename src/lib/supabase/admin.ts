import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

// =========================================================
// Cliente con la SERVICE ROLE KEY. Evade RLS, así que SOLO se
// usa en código de servidor (server actions / server components)
// y SIEMPRE detrás del gate `is_platform_admin`. Nunca se importa
// en el cliente; la llave jamás es NEXT_PUBLIC.
// =========================================================
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY (o la URL) en el entorno del servidor.",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
