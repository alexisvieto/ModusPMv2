"use client";

import { useState } from "react";
import { Check, Copy, Download, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { encuestaDef, optLabel } from "@/lib/comercial/encuesta";

type Data = {
  cliente?: string;
  referencia?: string;
  tipo?: string;
  respuestas?: Record<string, string>;
  comentarios?: string;
};

export function SurveyAdminView({
  recordId,
  recordLabel,
  formatCode,
  status,
  answeredAt,
  publicToken,
  data,
}: {
  recordId: string;
  recordLabel: string;
  formatCode: string;
  status: string;
  answeredAt: string | null;
  publicToken: string | null;
  data: unknown;
}) {
  const d = (data ?? {}) as Data;
  const def = encuestaDef(d.tipo ?? "suministro");
  const respuestas = d.respuestas ?? {};
  const answered = status === "completado";
  const [copied, setCopied] = useState(false);

  const link =
    publicToken && typeof window !== "undefined"
      ? `${window.location.origin}/encuesta/${publicToken}`
      : "";

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  const waHref = link
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola, agradecemos que respondas nuestra breve encuesta de satisfacción: ${link}`,
      )}`
    : "#";

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">{recordLabel}</span>
          {answered ? (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Respondida{answeredAt ? ` · ${answeredAt.slice(0, 10)}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Esperando respuesta
            </span>
          )}
        </div>
        {answered && (
          <Button
            variant="outline"
            onClick={() => window.open(`/api/comercial/encuesta/${recordId}/pdf`, "_blank")}
            title="Descargar la encuesta respondida en PDF"
          >
            <Download className="size-4" />
            Descargar PDF
          </Button>
        )}
      </div>

      {/* Contexto */}
      <div className="rounded-lg border bg-card p-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">Cliente</span>
            <p className="font-medium">{d.cliente || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">{def.refLabel}</span>
            <p className="font-medium">{d.referencia || "—"}</p>
          </div>
        </div>
      </div>

      {/* Enlace para compartir (mientras no responden) */}
      {!answered && link && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4 text-[#0f2044]" />
            Enlace para el cliente
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="h-9 flex-1 rounded-md border border-input bg-muted/40 px-3 text-xs outline-none"
            />
            <Button variant="outline" size="sm" onClick={copiar}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <MessageCircle className="size-4" />
            Enviar por WhatsApp
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            El cliente lo abre desde su celular, sin iniciar sesión. La respuesta
            aparece aquí automáticamente.
          </p>
        </div>
      )}

      {/* Respuestas del cliente */}
      {answered ? (
        <>
          {def.secciones.map((sec) => (
            <section key={sec.titulo} className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-[#0f2044]">{sec.titulo}</h2>
              <div className="space-y-3">
                {sec.preguntas.map((q) => (
                  <div key={q.id} className="text-sm">
                    <p className="text-muted-foreground">{q.label}</p>
                    <p className="font-medium">{optLabel(q.id, respuestas[q.id] ?? "")}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {def.comentarios && d.comentarios && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold text-[#0f2044]">
                Comentarios adicionales
              </h2>
              <p className="text-sm">{d.comentarios}</p>
            </section>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay respuesta. Comparte el enlace con el cliente.
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Formato {formatCode} · {recordLabel}
      </p>
    </main>
  );
}
