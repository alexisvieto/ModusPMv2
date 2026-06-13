import { notFound } from "next/navigation";

import { InventoryBoard } from "@/components/inventory/inventory-board";
import { brandFromOrg, ORG_BRAND_COLUMNS } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export default async function InventarioPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name, code")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: items }, { data: tasks }, { data: org }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, wbs, name")
      .eq("project_id", projectId)
      .order("wbs", { ascending: true }),
    supabase
      .from("organizations")
      .select(ORG_BRAND_COLUMNS)
      .eq("id", project.organization_id)
      .maybeSingle(),
  ]);
  const brand = brandFromOrg(org);

  // Seguridad: no difundir las credenciales iLO en el listado (irían a cada
  // cliente). El editor y el export las cargan bajo demanda por ítem.
  const safeItems = (items ?? []).map((it) => ({
    ...it,
    ilo_password: null,
    ilo_license: null,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Equipos y materiales del proyecto — recepción, estado y ubicación.
        </p>
      </div>
      <InventoryBoard
        project={project}
        items={safeItems}
        tasks={tasks ?? []}
        brand={brand}
      />
    </div>
  );
}
