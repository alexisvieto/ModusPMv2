import { InspeccionesBoard, type Inspeccion } from "@/components/hse/inspecciones-board";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "hse-evidence";

export default async function InspeccionesPage() {
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

  const { data: rows } = await supabase
    .from("hse_inspecciones")
    .select("*")
    .eq("organization_id", orgId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

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

  const initial: Inspeccion[] = (rows ?? []).map((r) => {
    const fotos = Array.isArray(r.fotos) ? (r.fotos as string[]) : [];
    return {
      id: r.id,
      fecha: r.fecha,
      ubicacion: r.ubicacion ?? "",
      tipo_inspeccion: r.tipo_inspeccion ?? "",
      hallazgo: r.hallazgo,
      riesgo: r.riesgo as Inspeccion["riesgo"],
      accion_requerida: r.accion_requerida ?? "",
      responsable: r.responsable ?? "",
      fecha_limite: r.fecha_limite ?? "",
      estado: r.estado as Inspeccion["estado"],
      fotos,
      foto_urls: fotos.map((p) => urlByPath.get(p) ?? ""),
    };
  });

  return <InspeccionesBoard orgId={orgId} initial={initial} />;
}
