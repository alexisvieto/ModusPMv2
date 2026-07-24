import { notFound } from "next/navigation";

import { ScopeReport } from "@/components/takeoff/scope-report";
import { brandFromOrg, ORG_BRAND_COLUMNS, type OrgBranding } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export default async function PliegoReportPage({
  params,
}: {
  params: Promise<{ projectId: string; docId: string }>;
}) {
  const { projectId, docId } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("takeoff_scope_docs")
    .select("*")
    .eq("id", docId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!doc || doc.status !== "analizado") notFound();

  const [{ data: items }, { data: org }] = await Promise.all([
    supabase
      .from("takeoff_scope_items")
      .select("*")
      .eq("scope_doc_id", docId)
      .order("category", { ascending: true }),
    supabase
      .from("organizations")
      .select(`${ORG_BRAND_COLUMNS}, company_tax_id, report_footer`)
      .eq("id", doc.organization_id)
      .maybeSingle(),
  ]);

  const brand = brandFromOrg(org as unknown as OrgBranding | null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <ScopeReport
        projectId={projectId}
        doc={doc}
        items={items ?? []}
        brand={brand}
        taxId={(org as { company_tax_id?: string | null } | null)?.company_tax_id ?? null}
        reportFooter={(org as { report_footer?: string | null } | null)?.report_footer ?? null}
      />
    </div>
  );
}
