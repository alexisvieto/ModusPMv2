import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DocRecordsList } from "@/components/comercial/doc-records-list";
import { requireDepartment } from "@/lib/access";
import { emptyDataForCode } from "@/lib/comercial/formats";
import { createClient } from "@/lib/supabase/server";

// Lista de registros de un formato (ej. todas las minutas de visita).
export default async function DocFormatPage({
  params,
}: {
  params: Promise<{ key: string; code: string }>;
}) {
  const { key, code } = await params;
  await requireDepartment(key);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .maybeSingle();
  const org = membership?.organization_id ?? "";

  const { data: format } = await supabase
    .from("doc_formats")
    .select("id, code, name, record_prefix, kind")
    .eq("organization_id", org)
    .eq("code", code)
    .eq("department_key", key)
    .maybeSingle();
  if (!format) notFound();

  const { data: records } = await supabase
    .from("doc_records")
    .select("id, record_label, title, status, created_at, created_by_name, data")
    .eq("organization_id", org)
    .eq("format_id", format.id)
    .order("record_no", { ascending: false });

  const rows = (records ?? []).map((r) => {
    const d = (r.data ?? {}) as { fecha_visita?: string };
    return {
      id: r.id,
      label: r.record_label,
      title: r.title,
      status: r.status,
      fecha: d.fecha_visita ?? "",
      createdBy: r.created_by_name,
    };
  });

  const isSurvey = format.kind === "public_survey";

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-[#0f2044] px-4 text-white md:px-6">
        <Link
          href={`/app/d/${key}`}
          className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </Link>
        <span className="h-4 w-px bg-white/20" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{format.name}</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/70">
            {format.code}
          </span>
        </div>
      </header>

      <DocRecordsList
        formatId={format.id}
        formatName={format.name}
        basePath={`/app/d/${key}/doc/${code}`}
        rows={rows}
        newLabel={`Nueva ${(format.record_prefix ?? "registro").toLowerCase()}`}
        newData={emptyDataForCode(format.code)}
        isSurvey={isSurvey}
      />
    </div>
  );
}
