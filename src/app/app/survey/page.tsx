import Link from "next/link";
import { ClipboardList, MapPin, Users } from "lucide-react";

import { NewSurveyButton } from "@/components/survey/new-survey-button";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  completado: "Completado",
};

export default async function SurveyHome() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  const { data: surveys } = orgId
    ? await supabase
        .from("survey_surveys")
        .select(
          "id, client_name, project_name, site_location, survey_date, personnel, field_days, status",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site Survey</h1>
          <p className="text-sm text-muted-foreground">
            Inspección de sitio previa a la propuesta.
          </p>
        </div>
        {orgId && <NewSurveyButton orgId={orgId} />}
      </div>

      {surveys && surveys.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {surveys.map((s) => (
            <Link
              key={s.id}
              href={`/app/survey/${s.id}`}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-[#0f2044]/30"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold leading-tight text-[#0f2044]">
                  {s.client_name || "Sin cliente"}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
              {s.project_name && (
                <span className="text-sm text-foreground">{s.project_name}</span>
              )}
              {s.site_location && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{s.site_location}</span>
                </span>
              )}
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span>{s.survey_date}</span>
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {s.personnel} pers · {Number(s.field_days)} d
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Aún no hay inspecciones. Crea la primera con “Nuevo survey”.
          </p>
        </div>
      )}
    </div>
  );
}
