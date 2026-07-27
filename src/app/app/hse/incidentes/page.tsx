import { IncidentesBoard, type Incidente } from "@/components/hse/incidentes-board";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "hse-evidence";

export default async function IncidentesPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  if (!orgId) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm text-muted-foreground">Sin organización.</div>
    );
  }

  const [{ data: rows }, { data: empleados }] = await Promise.all([
    supabase
      .from("hse_incidentes")
      .select("*")
      .eq("organization_id", orgId)
      .order("fecha_evento", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("hse_empleados")
      .select("id, nombre")
      .eq("organization_id", orgId)
      .eq("activo", true)
      .order("nombre", { ascending: true }),
  ]);

  const empById = new Map((empleados ?? []).map((e) => [e.id, e.nombre]));

  // Firma todas las fotos en una sola llamada.
  const allPaths = (rows ?? []).flatMap((r) =>
    Array.isArray(r.fotos) ? (r.fotos as string[]) : [],
  );
  const urlByPath = new Map<string, string>();
  if (allPaths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(allPaths, 3600);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl) urlByPath.set(allPaths[i], s.signedUrl);
    });
  }

  const initial: Incidente[] = (rows ?? []).map((r) => {
    const fotos = Array.isArray(r.fotos) ? (r.fotos as string[]) : [];
    return {
      id: r.id,
      tipo_evento: r.tipo_evento as Incidente["tipo_evento"],
      severidad: r.severidad as Incidente["severidad"],
      fecha_evento: r.fecha_evento,
      hora_evento: r.hora_evento ?? "",
      ubicacion: r.ubicacion ?? "",
      descripcion: r.descripcion,
      empleado_afectado: r.empleado_afectado,
      afectado_nombre: r.empleado_afectado ? (empById.get(r.empleado_afectado) ?? null) : null,
      dias_perdidos: r.dias_perdidos,
      requirio_atencion_medica: r.requirio_atencion_medica,
      causa_raiz: r.causa_raiz ?? "",
      accion_correctiva: r.accion_correctiva ?? "",
      estado: r.estado as Incidente["estado"],
      fotos,
      foto_urls: fotos.map((p) => urlByPath.get(p) ?? ""),
    };
  });

  return (
    <IncidentesBoard
      orgId={orgId}
      empleados={(empleados ?? []).map((e) => ({ id: e.id, nombre: e.nombre }))}
      initial={initial}
    />
  );
}
