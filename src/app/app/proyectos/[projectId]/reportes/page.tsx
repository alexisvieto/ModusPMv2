import { notFound } from "next/navigation";

import { ReportBoard } from "@/components/reports/report-board";
import { brandFromOrg, ORG_BRAND_COLUMNS } from "@/lib/brand";
import { orgMemberProfiles } from "@/lib/supabase/org-profiles";
import { createClient } from "@/lib/supabase/server";

export default async function ReportesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, name, code, client_name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  // Paginado: los últimos PAGE reportes; el board carga más bajo demanda.
  const PAGE = 60;
  const [{ data: reports, count }, profiles, { data: org }] = await Promise.all([
    supabase
      .from("daily_reports")
      .select("*, daily_report_entries(description, quantity, unit)", {
        count: "exact",
      })
      .eq("project_id", projectId)
      .order("report_date", { ascending: false })
      .order("id", { ascending: false })
      .range(0, PAGE - 1),
    orgMemberProfiles(supabase, project.organization_id),
    supabase
      .from("organizations")
      .select(ORG_BRAND_COLUMNS)
      .eq("id", project.organization_id)
      .maybeSingle(),
  ]);
  const brand = brandFromOrg(org);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reportes diarios
        </h1>
        <p className="text-sm text-muted-foreground">
          Bitácora de obra — exporta a PDF para el cliente y resume con IA.
        </p>
      </div>
      <ReportBoard
        project={project}
        reports={reports ?? []}
        profiles={profiles}
        currentUserId={user?.id ?? null}
        brand={brand}
        totalCount={count ?? 0}
        pageSize={PAGE}
      />
    </div>
  );
}
