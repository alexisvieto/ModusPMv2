import { createAdminClient } from "@/lib/supabase/admin";

// =========================================================
// Gate de IA por tenant — SOLO servidor (usa el service role).
// Centraliza lo que toda ruta de IA debe verificar antes de
// llamar a Claude: switch del tenant, rate-limit persistente,
// presupuesto mensual y la llave (BYOK del Vault o la global).
// =========================================================

// Precios por millón de tokens (USD). Un modelo desconocido se
// cotiza como opus: el peor caso, para nunca subestimar el gasto.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function costUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? PRICING["claude-opus-4-8"];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export type AiGate =
  | { ok: true; model: string; apiKey: string }
  | { ok: false; status: number; error: string };

export async function gateAiRequest(opts: {
  organizationId: string;
  userId: string;
  route: string;
  rateMs: number;
}): Promise<AiGate> {
  const admin = createAdminClient();

  const { data: cfg } = await admin
    .from("ai_provider_configs")
    .select("is_enabled, model, monthly_budget_usd")
    .eq("organization_id", opts.organizationId)
    .maybeSingle();
  if (cfg && cfg.is_enabled === false) {
    return {
      ok: false,
      status: 403,
      error:
        "La IA está deshabilitada para esta organización (actívala en el módulo IA).",
    };
  }

  // Rate-limit persistente: sobrevive a los reciclajes de instancia de Vercel
  // (el Map en memoria de cada ruta queda solo como primer filtro barato).
  const since = new Date(Date.now() - opts.rateMs).toISOString();
  const { count } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", opts.userId)
    .eq("route", opts.route)
    .gte("created_at", since);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      status: 429,
      error: "Espera unos segundos antes de volver a usar la IA.",
    };
  }

  // Presupuesto mensual del tenant (mes calendario, UTC).
  if (cfg?.monthly_budget_usd != null) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString();
    const { data: rows } = await admin
      .from("ai_usage")
      .select("cost_usd")
      .eq("organization_id", opts.organizationId)
      .gte("created_at", monthStart);
    const spent = (rows ?? []).reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
    if (spent >= Number(cfg.monthly_budget_usd)) {
      return {
        ok: false,
        status: 403,
        error:
          "Se agotó el presupuesto mensual de IA de la organización. Un admin puede ajustarlo en el módulo IA.",
      };
    }
  }

  // Llave: primero la BYOK del tenant (Vault, vía RPC solo-service-role);
  // si el tenant no tiene, la global del servidor.
  const { data: byok } = await admin.rpc("get_org_ai_key", {
    p_org: opts.organizationId,
  });
  const apiKey = (byok as string | null) ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      error:
        "Falta la API key de Claude: configura la llave de la organización en el módulo IA (o ANTHROPIC_API_KEY en el servidor).",
    };
  }

  return { ok: true, model: cfg?.model || "claude-opus-4-8", apiKey };
}

/** Registra el uso después de una llamada exitosa. Best-effort: nunca rompe la respuesta. */
export async function recordAiUsage(opts: {
  organizationId: string;
  userId: string;
  projectId: string | null;
  route: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("ai_usage").insert({
      organization_id: opts.organizationId,
      user_id: opts.userId,
      project_id: opts.projectId,
      route: opts.route,
      model: opts.model,
      input_tokens: opts.inputTokens,
      output_tokens: opts.outputTokens,
      cost_usd: costUsd(opts.model, opts.inputTokens, opts.outputTokens),
    });
  } catch {
    // El registro de gasto no debe tumbar una respuesta ya generada.
  }
}
