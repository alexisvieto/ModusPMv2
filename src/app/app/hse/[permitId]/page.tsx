import { notFound } from "next/navigation";

import { PermitEditor } from "@/components/hse/permit-editor";
import {
  type ChecklistFilled,
  type PermitPersonal,
  type PermitTypeKey,
} from "@/lib/hse/permits";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "hse-evidence";

export default async function PermitPage({
  params,
}: {
  params: Promise<{ permitId: string }>;
}) {
  const { permitId } = await params;
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("hse_permits")
    .select("*")
    .eq("id", permitId)
    .maybeSingle();
  if (!p) notFound();

  const personal = (p.personal ?? []) as PermitPersonal[];

  // URLs firmadas de todas las firmas (emisor, vigía, personal).
  const paths = [
    p.emisor_firma_path,
    p.vigia_firma_path,
    ...personal.map((x) => x.firma_path),
  ].filter((x): x is string => !!x);
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl) urlByPath.set(paths[i], s.signedUrl);
    });
  }

  return (
    <PermitEditor
      permit={{
        id: p.id,
        organization_id: p.organization_id,
        permit_type: p.permit_type as PermitTypeKey,
        empresa: p.empresa ?? "",
        ciudad_lugar: p.ciudad_lugar ?? "",
        area_proceso: p.area_proceso ?? "",
        ubicacion: p.ubicacion ?? "",
        fecha: p.fecha ?? "",
        fecha_inicio: p.fecha_inicio ?? "",
        fecha_fin: p.fecha_fin ?? "",
        hora_inicio: p.hora_inicio ?? "",
        hora_fin: p.hora_fin ?? "",
        descripcion_tarea: p.descripcion_tarea ?? "",
        altura_estimada: p.altura_estimada ?? "",
        equipo_a_usar: p.equipo_a_usar ?? "",
        emisor_nombre: p.emisor_nombre ?? "",
        emisor_cedula: p.emisor_cedula ?? "",
        emisor_firma_path: p.emisor_firma_path,
        vigia_nombre: p.vigia_nombre ?? "",
        vigia_cedula: p.vigia_cedula ?? "",
        vigia_firma_path: p.vigia_firma_path,
        observaciones: p.observaciones ?? "",
        estado: p.estado,
      }}
      initialPersonal={personal.map((x) => ({
        nombre: x.nombre ?? "",
        cedula: x.cedula ?? "",
        firma_path: x.firma_path,
        firma_url: x.firma_path ? (urlByPath.get(x.firma_path) ?? "") : "",
      }))}
      initialChecklist={(p.checklist ?? []) as ChecklistFilled[]}
      firmaUrls={{
        emisor: p.emisor_firma_path
          ? (urlByPath.get(p.emisor_firma_path) ?? "")
          : "",
        vigia: p.vigia_firma_path
          ? (urlByPath.get(p.vigia_firma_path) ?? "")
          : "",
      }}
    />
  );
}
