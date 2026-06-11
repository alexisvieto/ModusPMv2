import { notFound } from "next/navigation";

import { FatsatBoard } from "@/components/fatsat/fatsat-board";
import { createClient } from "@/lib/supabase/server";

export default async function FatSatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name, code, client_name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: protocols }, { data: equipment }] = await Promise.all([
    supabase
      .from("fatsat_protocols")
      .select("*, fatsat_points(*)")
      .eq("project_id", projectId)
      .order("protocol_date", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, description, brand_model, serial_number")
      .eq("project_id", projectId)
      .order("description"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pruebas FAT / SAT</h1>
        <p className="text-sm text-muted-foreground">
          Protocolos de aceptación en fábrica y en sitio — checklist, resultados y
          PDF firmable.
        </p>
      </div>
      <FatsatBoard
        project={project}
        protocols={protocols ?? []}
        equipment={equipment ?? []}
      />
    </div>
  );
}
