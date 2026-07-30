import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MinutaVisitaForm } from "@/components/comercial/minuta-visita-form";
import { VtF004Form } from "@/components/comercial/vtf004-form";
import { requireDepartment } from "@/lib/access";
import { toMinuta } from "@/lib/comercial/minuta";
import { toVtF004 } from "@/lib/comercial/vtf004";
import { createClient } from "@/lib/supabase/server";

export default async function DocRecordPage({
  params,
}: {
  params: Promise<{ key: string; code: string; recordId: string }>;
}) {
  const { key, code, recordId } = await params;
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
    .select("id, code, name")
    .eq("organization_id", org)
    .eq("code", code)
    .eq("department_key", key)
    .maybeSingle();
  if (!format) notFound();

  const { data: rec } = await supabase
    .from("doc_records")
    .select("id, record_label, title, status, data, created_by_name, created_at")
    .eq("id", recordId)
    .eq("format_id", format.id)
    .maybeSingle();
  if (!rec) notFound();

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-[#0f2044] px-4 text-white md:px-6">
        <Link
          href={`/app/d/${key}/doc/${code}`}
          className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {format.name}
        </Link>
        <span className="h-4 w-px bg-white/20" />
        <span className="text-sm font-semibold">{rec.record_label}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/70">
          {format.code}
        </span>
      </header>

      {format.code === "VT-F-004" ? (
        <VtF004Form
          recordId={rec.id}
          recordLabel={rec.record_label}
          formatCode={format.code}
          status={rec.status}
          elaboradoPor={rec.created_by_name}
          initial={toVtF004(rec.data)}
        />
      ) : (
        <MinutaVisitaForm
          recordId={rec.id}
          recordLabel={rec.record_label}
          formatCode={format.code}
          status={rec.status}
          elaboradoPor={rec.created_by_name}
          initial={toMinuta(rec.data)}
        />
      )}
    </div>
  );
}
