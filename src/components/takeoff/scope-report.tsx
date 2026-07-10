"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  isRiskCategory,
  SCOPE_CATEGORY_LABEL,
  SYSTEM_LABEL,
} from "@/lib/takeoff/catalog";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";
import type { Brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const ScopePdfButton = dynamic(() => import("./scope-pdf-button"), {
  ssr: false,
  loading: () => <span className="text-xs text-muted-foreground">Preparando PDF…</span>,
});

export type ScopeDocRow = Database["public"]["Tables"]["takeoff_scope_docs"]["Row"];
export type ScopeItemRow = Database["public"]["Tables"]["takeoff_scope_items"]["Row"];

const SEVERITY_STYLE: Record<string, { chip: string; dot: string; label: string }> = {
  alta: { chip: "bg-destructive/10 text-destructive", dot: "bg-destructive", label: "Alta" },
  media: { chip: "bg-warning/10 text-warning", dot: "bg-warning", label: "Media" },
  baja: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60", label: "Baja" },
};

export function ScopeReport({
  projectId,
  doc,
  items,
  brand,
  taxId,
  reportFooter,
}: {
  projectId: string;
  doc: ScopeDocRow;
  items: ScopeItemRow[];
  brand: Brand;
  taxId: string | null;
  reportFooter: string | null;
}) {
  const riesgos = items
    .filter((i) => isRiskCategory(i.category))
    .sort((a, b) => {
      const w: Record<string, number> = { alta: 0, media: 1, baja: 2 };
      return (w[a.severity ?? "baja"] ?? 3) - (w[b.severity ?? "baja"] ?? 3);
    });
  const equipos = items.filter((i) => i.category === "equipo");
  const normas = items.filter((i) => i.category === "norma");
  const entregables = items.filter((i) => i.category === "entregable");
  const alcance = items.filter((i) => i.category === "alcance" || i.category === "tarea");

  const sistemas = [...new Set(alcance.map((i) => i.system_type).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/app/proyectos/${projectId}/calculo`}
            className={cn(
              buttonVariants({ size: "sm", variant: "ghost" }),
              "-ml-2 mb-1",
            )}
          >
            <ArrowLeft className="size-4" />
            Cálculo de planos
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            {doc.project_title || doc.doc_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {doc.contracting_entity ? `${doc.contracting_entity} · ` : ""}
            {doc.location ? `${doc.location} · ` : ""}
            {doc.tender_ref ? `Ref. ${doc.tender_ref} · ` : ""}
            Analizado el{" "}
            {doc.analyzed_at
              ? formatDate(doc.analyzed_at.slice(0, 10), {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
        <ScopePdfButton
          data={{ brand, taxId, reportFooter, doc, items }}
          fileName={`Analisis_Pliego_${(doc.project_title ?? doc.doc_name).slice(0, 40).replace(/[^\w]+/g, "_")}.pdf`}
        />
      </div>

      {/* Resumen ejecutivo */}
      {doc.executive_summary && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold">Resumen ejecutivo</h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {doc.executive_summary.split(/\n{2,}|\n(?=\S)/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Panel de riesgos — la sección destacada */}
      <Card className="border-destructive/30">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="size-4 text-destructive" />
            <h2 className="text-sm font-semibold">
              Riesgos y condiciones económicas ({riesgos.length})
            </h2>
          </div>
          {riesgos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se detectaron riesgos ni condiciones especiales en el documento.
            </p>
          ) : (
            <div className="space-y-2">
              {riesgos.map((r) => {
                const sv = SEVERITY_STYLE[r.severity ?? "baja"] ?? SEVERITY_STYLE.baja;
                return (
                  <div key={r.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          sv.chip,
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", sv.dot)} />
                        {sv.label}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {SCOPE_CATEGORY_LABEL[r.category] ?? r.category}
                      </span>
                      {r.cost_impact && (
                        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                          impacta costos
                        </span>
                      )}
                      {r.page_ref && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {r.page_ref}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm">{r.description}</p>
                    {r.quote && (
                      <p className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground">
                        “{r.quote}”
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sistemas y alcance */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Sistemas y alcance</h2>
          {sistemas.length === 0 && alcance.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alcance desglosado.</p>
          ) : (
            <div className="space-y-4">
              {[...sistemas, null].map((sys) => {
                const rows = alcance.filter((i) => i.system_type === sys);
                if (!rows.length) return null;
                return (
                  <div key={sys ?? "general"}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {sys ? (SYSTEM_LABEL[sys] ?? sys) : "General del proyecto"}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {rows.map((i) => (
                        <li key={i.id} className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                          <span>
                            {i.description}
                            {i.page_ref && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({i.page_ref})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipos especificados */}
      <Card>
        <CardContent className="p-0">
          <h2 className="border-b p-5 pb-3 text-sm font-semibold">
            Equipos especificados ({equipos.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Equipo</th>
                  <th className="px-3 py-2 font-medium">Fabricante</th>
                  <th className="px-3 py-2 font-medium">Modelo</th>
                  <th className="px-3 py-2 text-right font-medium">Cant. mín.</th>
                  <th className="px-3 py-2 text-right font-medium">Pág.</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="px-5 py-2">{e.description}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.manufacturer ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.model ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {e.qty_specified ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {e.page_ref ?? "—"}
                    </td>
                  </tr>
                ))}
                {equipos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      El pliego no especifica equipos con fabricante/modelo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Normas y entregables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold">Normas y estándares</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {normas.map((n) => (
                <li key={n.id}>• {n.description}</li>
              ))}
              {normas.length === 0 && <li>Sin normas explícitas.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold">Entregables y condiciones</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {entregables.map((n) => (
                <li key={n.id}>• {n.description}</li>
              ))}
              {entregables.length === 0 && <li>Sin entregables explícitos.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
