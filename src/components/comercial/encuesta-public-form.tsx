"use client";

import { useState } from "react";

import { encuestaDef } from "@/lib/comercial/encuesta";
import { createClient } from "@/lib/supabase/client";

type Brand = { name: string; logo_url: string; primary: string; accent: string; dark: string };

export function EncuestaPublicForm({
  token,
  tipo,
  brand,
}: {
  token: string;
  tipo: string;
  brand: Brand;
}) {
  const def = encuestaDef(tipo);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = def.secciones.reduce((n, s) => n + s.preguntas.length, 0);
  const answered = Object.values(resp).filter(Boolean).length;

  async function enviar() {
    if (sending) return;
    if (answered < total) {
      setError("Por favor responde todas las preguntas antes de enviar.");
      return;
    }
    setError(null);
    setSending(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("survey_submit_public", {
      p_token: token,
      p_data: { respuestas: resp, comentarios } as never,
    });
    setSending(false);
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    if (err || !r.ok) {
      setError(r.error ?? "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: brand.accent }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold">¡Gracias por tu tiempo!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu opinión nos ayuda a mejorar continuamente nuestro servicio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Con la intención de mejorar nuestro servicio, agradecemos que dediques unos
        minutos a completar esta breve encuesta. Tu opinión es muy importante.
      </p>

      {def.secciones.map((sec) => (
        <section key={sec.titulo} className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold" style={{ color: brand.dark }}>
            {sec.titulo}
          </h2>
          <div className="space-y-5">
            {sec.preguntas.map((q) => (
              <div key={q.id}>
                <p className="mb-2 text-sm font-medium">{q.label}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => {
                    const active = resp[q.id] === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setResp((p) => ({ ...p, [q.id]: o.v }))}
                        className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                        style={
                          active
                            ? { backgroundColor: brand.accent, borderColor: brand.accent, color: "#fff" }
                            : { borderColor: "#e5e7eb", color: "#374151" }
                        }
                      >
                        {o.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {def.comentarios && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold" style={{ color: brand.dark }}>
            Comentarios adicionales
          </h2>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            rows={4}
            placeholder="¿Algún otro comentario o sugerencia? (opcional)"
            className="w-full rounded-lg border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30"
          />
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-4 pt-2">
        <p className="mb-2 text-center text-xs text-muted-foreground">
          {answered} de {total} respondidas
        </p>
        <button
          onClick={enviar}
          disabled={sending}
          className="w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
          style={{ backgroundColor: brand.primary }}
        >
          {sending ? "Enviando…" : "Enviar encuesta"}
        </button>
      </div>
    </div>
  );
}
