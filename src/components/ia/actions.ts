"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Provider = Database["public"]["Enums"]["ai_provider"];
type Result = { ok: boolean; error?: string };

export async function saveAiConfig(
  orgId: string,
  projectId: string,
  input: {
    provider: string;
    model: string;
    monthlyBudget: number | null;
    isEnabled: boolean;
  },
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autorizado." };

  const { error } = await supabase.from("ai_provider_configs").upsert(
    {
      organization_id: orgId,
      provider: input.provider as Provider,
      model: input.model.trim() || "claude-opus-4-8",
      monthly_budget_usd: input.monthlyBudget,
      is_enabled: input.isEnabled,
    },
    { onConflict: "organization_id" },
  );
  if (error) return { ok: false, error: "No se pudo guardar la configuración." };

  revalidatePath(`/app/proyectos/${projectId}/ia`);
  return { ok: true };
}

export async function saveAiKey(
  orgId: string,
  projectId: string,
  key: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autorizado." };

  // RPC write-only: guarda la llave cifrada en Vault (solo owner/admin).
  const { error } = await supabase.rpc("set_org_ai_key", {
    p_org: orgId,
    p_key: key,
  });
  if (error) {
    return {
      ok: false,
      error: /forbidden/i.test(error.message)
        ? "Solo un administrador puede configurar la llave."
        : "No se pudo guardar la llave.",
    };
  }

  revalidatePath(`/app/proyectos/${projectId}/ia`);
  return { ok: true };
}

export async function clearAiKey(
  orgId: string,
  projectId: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autorizado." };

  const { error } = await supabase.rpc("clear_org_ai_key", { p_org: orgId });
  if (error) {
    return {
      ok: false,
      error: /forbidden/i.test(error.message)
        ? "Solo un administrador puede quitar la llave."
        : "No se pudo quitar la llave.",
    };
  }

  revalidatePath(`/app/proyectos/${projectId}/ia`);
  return { ok: true };
}
