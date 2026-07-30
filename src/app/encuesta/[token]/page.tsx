import { EncuestaPublicForm } from "@/components/comercial/encuesta-public-form";
import { createClient } from "@/lib/supabase/server";

type Brand = { name: string; logo_url: string; primary: string; accent: string; dark: string };
type SurveyInfo = {
  found?: boolean;
  answered?: boolean;
  expired?: boolean;
  format_name?: string;
  tipo?: string;
  cliente?: string;
  referencia?: string;
  brand?: Brand;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK: Brand = {
  name: "",
  logo_url: "",
  primary: "#0F2044",
  accent: "#E8A020",
  dark: "#0F2044",
};

// Encuesta pública (VT-F-002): la abre el cliente por enlace, SIN login. Mobile-first.
export default async function EncuestaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let info: SurveyInfo = { found: false };
  if (UUID.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("survey_get_public", { p_token: token });
    info = (data ?? { found: false }) as SurveyInfo;
  }
  const brand = info.brand ?? FALLBACK;

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        {/* Encabezado con marca */}
        <div className="mb-6 flex flex-col items-center text-center">
          {brand.logo_url ? (
            <div className="rounded-xl bg-white px-5 py-3 shadow-sm ring-1 ring-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-12 w-auto max-w-[240px] object-contain"
              />
            </div>
          ) : (
            <span className="text-lg font-bold" style={{ color: brand.dark }}>
              {brand.name}
            </span>
          )}
          <h1 className="mt-4 text-xl font-semibold" style={{ color: brand.dark }}>
            Encuesta de satisfacción
          </h1>
          {info.found && !info.answered && !info.expired && (
            <p className="mt-1 text-sm text-muted-foreground">
              {info.cliente ? info.cliente : ""}
              {info.referencia ? ` · ${info.referencia}` : ""}
            </p>
          )}
        </div>

        {!info.found ? (
          <State title="Enlace no válido" msg="Este enlace de encuesta no existe o fue removido." />
        ) : info.expired ? (
          <State title="El enlace expiró" msg="Este enlace ya no está disponible. Solicita uno nuevo." />
        ) : info.answered ? (
          <State
            title="¡Gracias!"
            msg="Esta encuesta ya fue respondida. Agradecemos tu tiempo y tu opinión."
            accent={brand.accent}
          />
        ) : (
          <EncuestaPublicForm token={token} tipo={info.tipo ?? "suministro"} brand={brand} />
        )}

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          {brand.name || "Nexus"} · encuesta segura
        </p>
      </div>
    </div>
  );
}

function State({ title, msg, accent }: { title: string; msg: string; accent?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      {accent && (
        <div
          className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: accent }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}
