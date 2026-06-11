import { notFound } from "next/navigation";

import { InventoryBoard } from "@/components/inventory/inventory-board";
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

  const [{ data: items }, { data: tasks }] = await Promise.all([
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
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Equipos y materiales del proyecto — recepción, estado y ubicación.
        </p>
      </div>
      <InventoryBoard project={project} items={items ?? []} tasks={tasks ?? []} />
    </div>
  );
}
