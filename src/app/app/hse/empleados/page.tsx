import { EmpleadosBoard } from "@/components/hse/empleados-board";
import { createClient } from "@/lib/supabase/server";

export default async function EmpleadosPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  const { data: rows } = orgId
    ? await supabase
        .from("hse_empleados")
        .select(
          "id, nombre, cedula, cargo, division, talla_casco, talla_camisa, talla_pantalon, talla_botas",
        )
        .eq("organization_id", orgId)
        .eq("activo", true)
        .order("nombre", { ascending: true })
    : { data: [] };

  if (!orgId) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">
        Sin organización.
      </div>
    );
  }

  return (
    <EmpleadosBoard
      orgId={orgId}
      initial={(rows ?? []).map((e) => ({
        id: e.id,
        nombre: e.nombre,
        cedula: e.cedula ?? "",
        cargo: e.cargo ?? "",
        division: e.division ?? "",
        talla_casco: e.talla_casco ?? "",
        talla_camisa: e.talla_camisa ?? "",
        talla_pantalon: e.talla_pantalon ?? "",
        talla_botas: e.talla_botas ?? "",
      }))}
    />
  );
}
