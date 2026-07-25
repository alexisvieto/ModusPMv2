import { notFound } from "next/navigation";

import { SystemView } from "@/components/takeoff/system-view";
import { createClient } from "@/lib/supabase/server";

export default async function SistemaPage({
  params,
}: {
  params: Promise<{ estimateId: string; systemId: string }>;
}) {
  const { estimateId, systemId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: estimate } = await supabase
    .from("nexus_estimates")
    .select("id, organization_id, name")
    .eq("id", estimateId)
    .maybeSingle();
  if (!estimate) notFound();

  const { data: system } = await supabase
    .from("takeoff_systems")
    .select("*")
    .eq("id", systemId)
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (!system) notFound();

  // Análisis del sistema + hojas por separado (las FK compuestas rompen el
  // embed anidado de PostgREST); se agrupan en memoria.
  const { data: analysesRaw } = await supabase
    .from("takeoff_analyses")
    .select("*")
    .eq("system_id", systemId)
    .order("created_at", { ascending: false });
  const analysisIds = (analysesRaw ?? []).map((a) => a.id);
  const { data: sheetsRaw } = analysisIds.length
    ? await supabase
        .from("takeoff_sheets")
        .select("id, status, analysis_id")
        .in("analysis_id", analysisIds)
    : { data: [] };
  const analyses = (analysesRaw ?? []).map((a) => ({
    ...a,
    takeoff_sheets: (sheetsRaw ?? [])
      .filter((s) => s.analysis_id === a.id)
      .map((s) => ({ id: s.id, status: s.status })),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <SystemView
        estimate={estimate}
        system={system}
        analyses={analyses}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
