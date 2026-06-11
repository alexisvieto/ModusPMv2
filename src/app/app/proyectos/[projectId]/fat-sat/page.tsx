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

  const { data: pruebas } = await supabase
    .from("fatsat_protocols")
    .select("*, fatsat_points(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .order("sort_order", { referencedTable: "fatsat_points", ascending: true });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pruebas en campo</h1>
        <p className="text-sm text-muted-foreground">
          Protocolos de pruebas FAT/SAT — agrupa pruebas relacionadas, marca su
          resultado y exporta a PDF firmable.
        </p>
      </div>
      <FatsatBoard project={project} initialPruebas={pruebas ?? []} />
    </div>
  );
}
