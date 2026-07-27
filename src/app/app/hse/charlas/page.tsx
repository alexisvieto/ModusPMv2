import { CharlasBoard, type Asistencia, type Charla } from "@/components/hse/charlas-board";
import { createClient } from "@/lib/supabase/server";

export default async function CharlasPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!orgId) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm text-muted-foreground">Sin organización.</div>
    );
  }

  const [{ data: charlas }, { data: empleados }] = await Promise.all([
    supabase
      .from("hse_charlas")
      .select("*")
      .eq("organization_id", orgId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("hse_empleados")
      .select("id, nombre, cargo, division")
      .eq("organization_id", orgId)
      .eq("activo", true)
      .order("nombre", { ascending: true }),
  ]);

  const empById = new Map((empleados ?? []).map((e) => [e.id, e.nombre]));

  const charlaIds = (charlas ?? []).map((c) => c.id);
  const asByCharla = new Map<string, Asistencia[]>();
  if (charlaIds.length) {
    const { data: asis } = await supabase
      .from("hse_charla_asistencias")
      .select("charla_id, empleado_id, firma_path")
      .in("charla_id", charlaIds);
    (asis ?? []).forEach((a) => {
      const list = asByCharla.get(a.charla_id) ?? [];
      list.push({
        empleado_id: a.empleado_id,
        nombre: empById.get(a.empleado_id) ?? "—",
        firma_path: a.firma_path,
      });
      asByCharla.set(a.charla_id, list);
    });
  }

  const initial: Charla[] = (charlas ?? []).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    fecha: c.fecha,
    hora_inicio: c.hora_inicio ?? "",
    duracion_min: c.duracion_min != null ? String(c.duracion_min) : "",
    facilitador: c.facilitador ?? "",
    lugar: c.lugar ?? "",
    descripcion: c.descripcion ?? "",
    asistencias: asByCharla.get(c.id) ?? [],
  }));

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    "";

  return (
    <CharlasBoard
      orgId={orgId}
      empleados={(empleados ?? []).map((e) => ({
        id: e.id,
        nombre: e.nombre,
        cargo: e.cargo ?? "",
        division: e.division ?? "",
      }))}
      userName={userName}
      initial={initial}
    />
  );
}
