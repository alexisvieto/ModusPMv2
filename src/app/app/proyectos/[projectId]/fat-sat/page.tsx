import { notFound } from "next/navigation";

import { FatsatBoard } from "@/components/fatsat/fatsat-board";
import { brandFromOrg, ORG_BRAND_COLUMNS } from "@/lib/brand";
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

  const [{ data: pruebas }, { data: org }] = await Promise.all([
    supabase
      .from("fatsat_protocols")
      .select("*, fatsat_points(*)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .order("sort_order", { referencedTable: "fatsat_points", ascending: true }),
    supabase
      .from("organizations")
      .select(ORG_BRAND_COLUMNS)
      .eq("id", project.organization_id)
      .maybeSingle(),
  ]);
  const brand = brandFromOrg(org);

  // Proyectos de la misma organización (≠ actual) que tienen pruebas: origen
  // posible para clonar sus protocolos ATP a este proyecto.
  const { data: srcRows } = await supabase
    .from("projects")
    .select("id, name, fatsat_protocols(count)")
    .eq("organization_id", project.organization_id)
    .neq("id", projectId)
    .order("name", { ascending: true });
  const sources = (srcRows ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      count: (p.fatsat_protocols?.[0]?.count as number | undefined) ?? 0,
    }))
    .filter((p) => p.count > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pruebas en campo</h1>
        <p className="text-sm text-muted-foreground">
          Protocolos de pruebas FAT/SAT — agrupa pruebas relacionadas, marca su
          resultado y exporta a PDF firmable.
        </p>
      </div>
      <FatsatBoard
        project={project}
        initialPruebas={pruebas ?? []}
        brand={brand}
        sources={sources}
      />
    </div>
  );
}
