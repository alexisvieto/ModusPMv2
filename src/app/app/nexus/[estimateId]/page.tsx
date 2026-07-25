import { notFound } from "next/navigation";

import { EstimateEditor } from "@/components/nexus/estimate-editor";
import { DEFAULT_PARAMS, type CostKind, type NexusParams } from "@/lib/nexus/calc";
import { createClient } from "@/lib/supabase/server";

function paramsFrom(raw: unknown): NexusParams {
  const p = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) =>
    v == null || isNaN(Number(v)) ? d : Number(v);
  return {
    ind_oficina: num(p.ind_oficina, DEFAULT_PARAMS.ind_oficina),
    ind_campo: num(p.ind_campo, DEFAULT_PARAMS.ind_campo),
    financiamiento: num(p.financiamiento, DEFAULT_PARAMS.financiamiento),
    utilidad: num(p.utilidad, DEFAULT_PARAMS.utilidad),
    itbms: num(p.itbms, DEFAULT_PARAMS.itbms),
  };
}

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const { estimateId } = await params;
  const supabase = await createClient();

  const { data: est } = await supabase
    .from("nexus_estimates")
    .select(
      "id, organization_id, division_id, name, client_name, odoo_code, elaborated_by, estimate_date, params, status",
    )
    .eq("id", estimateId)
    .maybeSingle();
  if (!est) notFound();

  const [
    { data: cats },
    { data: orgCats },
    { data: profiles },
    { data: divisions },
    { data: catalog },
    { data: isAdmin },
  ] = await Promise.all([
      supabase
        .from("nexus_estimate_categories")
        .select("id, category_id, name, color, sort_order")
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("nexus_categories")
        .select("id, name, color, division_id")
        .eq("organization_id", est.organization_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("nexus_labor_profiles")
        .select("id, name, daily_rate")
        .eq("organization_id", est.organization_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("nexus_divisions")
        .select("id, name")
        .eq("organization_id", est.organization_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("nexus_catalog")
        .select("description, manufacturer, unit_price")
        .eq("organization_id", est.organization_id)
        .order("description", { ascending: true }),
      supabase.rpc("has_org_role", {
        org: est.organization_id,
        roles: ["owner", "admin"],
      }),
    ]);

  const catIds = (cats ?? []).map((c) => c.id);
  const [itemsRes, laborRes] = await Promise.all([
    catIds.length
      ? supabase
          .from("nexus_estimate_items")
          .select(
            "id, estimate_category_id, description, manufacturer, qty, unit_price, kind, unit, sort_order",
          )
          .in("estimate_category_id", catIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    catIds.length
      ? supabase
          .from("nexus_estimate_labor")
          .select(
            "id, estimate_category_id, profile_id, profile_name, daily_rate, personas, dias, sort_order",
          )
          .in("estimate_category_id", catIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const items = itemsRes.data ?? [];
  const labor = laborRes.data ?? [];

  const initialCategories = (cats ?? []).map((c) => ({
    uid: c.id,
    category_id: c.category_id,
    name: c.name,
    color: c.color,
    items: items
      .filter((i) => i.estimate_category_id === c.id)
      .map((i) => ({
        uid: i.id,
        description: i.description,
        manufacturer: i.manufacturer ?? "",
        kind: i.kind as CostKind,
        qty: String(i.qty),
        unit_price: String(i.unit_price),
        unit: i.unit ?? "und",
      })),
    labor: labor
      .filter((l) => l.estimate_category_id === c.id)
      .map((l) => ({
        uid: l.id,
        profile_id: l.profile_id,
        profile_name: l.profile_name,
        daily_rate: Number(l.daily_rate),
        personas: String(l.personas),
        dias: String(l.dias),
      })),
  }));

  return (
    <EstimateEditor
      estimate={{
        id: est.id,
        name: est.name,
        client_name: est.client_name ?? "",
        odoo_code: est.odoo_code ?? "",
        elaborated_by: est.elaborated_by ?? "",
        estimate_date: est.estimate_date,
        division_id: est.division_id,
        params: paramsFrom(est.params),
        status: est.status ?? "borrador",
      }}
      initialCategories={initialCategories}
      orgCategories={(orgCats ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        division_id: c.division_id,
      }))}
      laborProfiles={(profiles ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        daily_rate: Number(p.daily_rate),
      }))}
      divisions={(divisions ?? []).map((d) => ({ id: d.id, name: d.name }))}
      catalog={(catalog ?? []).map((c) => ({
        description: c.description,
        manufacturer: c.manufacturer,
        unit_price: Number(c.unit_price),
      }))}
      isAdmin={!!isAdmin}
    />
  );
}
