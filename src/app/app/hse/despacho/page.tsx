import { DespachoBoard } from "@/components/hse/despacho-board";
import { createClient } from "@/lib/supabase/server";

export default async function DespachoPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  const [{ data: empleados }, { data: items }] = orgId
    ? await Promise.all([
        supabase
          .from("hse_empleados")
          .select("id, nombre")
          .eq("organization_id", orgId)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
        supabase
          .from("hse_epp_items")
          .select("id, nombre, stock_actual, vida_util_dias")
          .eq("organization_id", orgId)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  if (!orgId) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm text-muted-foreground">
        Sin organización.
      </div>
    );
  }

  return (
    <DespachoBoard
      orgId={orgId}
      empleados={(empleados ?? []).map((e) => ({ id: e.id, nombre: e.nombre }))}
      items={(items ?? []).map((i) => ({
        id: i.id,
        nombre: i.nombre,
        stock_actual: i.stock_actual ?? 0,
        vida_util_dias: i.vida_util_dias,
      }))}
    />
  );
}
