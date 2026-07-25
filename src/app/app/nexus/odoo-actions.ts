"use server";

import { revalidatePath } from "next/cache";

import { bucketsFrom, calcCascade, DEFAULT_PARAMS, type NexusParams } from "@/lib/nexus/calc";
import { pushToExistingOrder, testConnection } from "@/lib/nexus/odoo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

function paramsFrom(raw: unknown): NexusParams {
  const p = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown, d: number) => (v == null || isNaN(Number(v)) ? d : Number(v));
  return {
    ind_oficina: n(p.ind_oficina, DEFAULT_PARAMS.ind_oficina),
    ind_campo: n(p.ind_campo, DEFAULT_PARAMS.ind_campo),
    financiamiento: n(p.financiamiento, DEFAULT_PARAMS.financiamiento),
    utilidad: n(p.utilidad, DEFAULT_PARAMS.utilidad),
    itbms: n(p.itbms, DEFAULT_PARAMS.itbms),
  };
}

async function requireAdmin(orgId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autorizado." };
  const { data: isAdmin } = await supabase.rpc("has_org_role", {
    org: orgId,
    roles: ["owner", "admin"],
  });
  if (!isAdmin) return { ok: false as const, error: "Solo un administrador puede configurar Odoo." };
  return { ok: true as const };
}

// ── Config (admin) ──
export async function saveOdooConfig(
  orgId: string,
  input: { url: string; db: string; login: string; defaultProductId: number | null; isEnabled: boolean },
): Promise<Result> {
  const gate = await requireAdmin(orgId);
  if (!gate.ok) return gate;
  const supabase = await createClient();
  const { error } = await supabase.from("nexus_odoo_config").upsert(
    {
      organization_id: orgId,
      url: input.url.trim() || null,
      db: input.db.trim() || null,
      login: input.login.trim() || null,
      default_product_id: input.defaultProductId,
      is_enabled: input.isEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) return { ok: false, error: "No se pudo guardar la configuración." };
  revalidatePath("/app/nexus/config");
  return { ok: true };
}

export async function saveOdooKey(orgId: string, key: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_org_odoo_key", { p_org: orgId, p_key: key });
  if (error) {
    return {
      ok: false,
      error: /forbidden/i.test(error.message)
        ? "Solo un administrador puede configurar la API key."
        : "No se pudo guardar la API key.",
    };
  }
  revalidatePath("/app/nexus/config");
  return { ok: true };
}

export async function clearOdooKey(orgId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_org_odoo_key", { p_org: orgId });
  if (error) {
    return {
      ok: false,
      error: /forbidden/i.test(error.message)
        ? "Solo un administrador puede quitar la API key."
        : "No se pudo quitar la API key.",
    };
  }
  revalidatePath("/app/nexus/config");
  return { ok: true };
}

// ── Probar conexión (admin) ──
export async function testOdooConnection(
  orgId: string,
): Promise<{ ok: boolean; error?: string; version?: string }> {
  const gate = await requireAdmin(orgId);
  if (!gate.ok) return gate;

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("nexus_odoo_config")
    .select("url, db, login")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!cfg?.url || !cfg.db || !cfg.login) {
    return { ok: false, error: "Faltan URL, base de datos o usuario." };
  }
  const { data: key } = await admin.rpc("get_org_odoo_key", { p_org: orgId });
  if (!key) return { ok: false, error: "Falta la API key (guardala primero)." };

  const r = await testConnection({ url: cfg.url, db: cfg.db, login: cfg.login, key });
  return r.ok ? { ok: true, version: r.version } : { ok: false, error: r.error };
}

// ── Enviar cotización a Odoo (miembro con escritura) ──
export async function sendToOdoo(
  estimateId: string,
): Promise<{ ok: boolean; error?: string; orderName?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autorizado." };

  // RLS ya limita el estimado a la org del usuario.
  const { data: est } = await supabase
    .from("nexus_estimates")
    .select("id, organization_id, name, odoo_code, params")
    .eq("id", estimateId)
    .maybeSingle();
  if (!est) return { ok: false, error: "Cotización no encontrada." };
  if (!est.odoo_code) return { ok: false, error: "Ponle el Código Odoo (S00XXX) a la cotización." };

  const { data: canWrite } = await supabase.rpc("has_org_role", {
    org: est.organization_id,
    roles: ["owner", "admin", "project_manager", "member"],
  });
  if (!canWrite) return { ok: false, error: "No tienes permiso para enviar a Odoo." };

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("nexus_odoo_config")
    .select("url, db, login, default_product_id, is_enabled, api_key_set")
    .eq("organization_id", est.organization_id)
    .maybeSingle();
  if (!cfg?.is_enabled) return { ok: false, error: "La integración con Odoo está deshabilitada." };
  if (!cfg.url || !cfg.db || !cfg.login || !cfg.api_key_set) {
    return { ok: false, error: "Completa la configuración de Odoo (Nexus → Config)." };
  }
  if (!cfg.default_product_id) {
    return { ok: false, error: "Configurá el producto Odoo por defecto para las líneas." };
  }
  const { data: key } = await admin.rpc("get_org_odoo_key", { p_org: est.organization_id });
  if (!key) return { ok: false, error: "Falta la API key de Odoo." };

  // Cargar el árbol y calcular el subtotal (sin ITBMS) por categoría.
  const { data: cats } = await admin
    .from("nexus_estimate_categories")
    .select("id, name, sort_order")
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });
  const catIds = (cats ?? []).map((c) => c.id);
  const [{ data: items }, { data: labor }] = await Promise.all([
    catIds.length
      ? admin.from("nexus_estimate_items").select("estimate_category_id, kind, qty, unit_price").in("estimate_category_id", catIds)
      : Promise.resolve({ data: [] as never[] }),
    catIds.length
      ? admin.from("nexus_estimate_labor").select("estimate_category_id, personas, dias, daily_rate").in("estimate_category_id", catIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const params = paramsFrom(est.params);
  const lines = (cats ?? [])
    .map((c) => {
      const b = bucketsFrom(
        (items ?? [])
          .filter((i) => i.estimate_category_id === c.id)
          .map((i) => ({ kind: i.kind as "Material" | "ManoDeObra" | "Herramienta" | "Flete", qty: Number(i.qty), unit_price: Number(i.unit_price) })),
        (labor ?? [])
          .filter((l) => l.estimate_category_id === c.id)
          .map((l) => ({ personas: Number(l.personas), dias: Number(l.dias), daily_rate: Number(l.daily_rate) })),
      );
      return { name: c.name, price: calcCascade(b, params).subtotal };
    })
    .filter((l) => l.price > 0);

  if (!lines.length) return { ok: false, error: "La cotización no tiene montos para enviar." };

  const r = await pushToExistingOrder(
    { url: cfg.url, db: cfg.db, login: cfg.login, key },
    { odooCode: est.odoo_code, productId: cfg.default_product_id, lines },
  );
  return r.ok ? { ok: true, orderName: r.orderName } : { ok: false, error: r.error };
}
