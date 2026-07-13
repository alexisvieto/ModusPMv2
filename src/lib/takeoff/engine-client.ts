// =========================================================
// Cliente del servicio Python del motor de conteo (SOLO servidor).
// El servicio no es público: se autentica con un secreto compartido en el
// header X-Engine-Secret. Los PDF se pasan por URL firmada, nunca en el body.
// =========================================================

// Normaliza la URL del motor para tolerar cómo se pegue en la variable de
// entorno: sin esquema le antepone https:// (si no, fetch lanza "Failed to
// parse URL"), y sin barra final (una barra de más produciría `//legend`).
function normalizeBase(raw: string): string {
  const v = raw.trim().replace(/\/+$/, "");
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const BASE = normalizeBase(process.env.TAKEOFF_ENGINE_URL ?? "");
const SECRET = process.env.TAKEOFF_ENGINE_SECRET ?? "";

export type EngineSymbol = { symbol: string; element_key: string; name: string };
export type EngineSignature = {
  kind: "circulo" | "caja_x" | "texto";
  token: string | null;
  size: number | null;
};
export type EngineDetection = {
  element_key: string;
  x: number;
  y: number;
  confidence: "alta" | "media" | "baja";
  method: "texto" | "geometria" | "vision" | "manual";
  signature?: EngineSignature | null;
};
export type EngineCandidate = {
  kind: "circulo" | "caja";
  x: number;
  y: number;
  size: number | null;
};
export type EngineAnalyzeResult = {
  detections: EngineDetection[];
  candidates?: EngineCandidate[];
  is_vector: boolean;
  page_width: number;
  page_height: number;
  stats: Record<string, unknown>;
};

export class EngineUnavailable extends Error {}

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!BASE || !SECRET) {
    throw new EngineUnavailable(
      "El motor de cálculo no está configurado (TAKEOFF_ENGINE_URL / _SECRET).",
    );
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Engine-Secret": SECRET },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Motor (${res.status}): ${detail.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Recorte de la leyenda para leerla con visión (en Next, con su gate de IA). */
export function engineLegend(pdfUrl: string, systemType: string) {
  return call<{
    image_base64: string;
    found: boolean;
    page_width: number;
    page_height: number;
    is_vector: boolean;
  }>("/legend", { pdf_url: pdfUrl, system_type: systemType });
}

/** Imagen del plano completo para el overlay del visor. */
export function engineRender(pdfUrl: string, pageIndex = 0) {
  return call<{ image_base64: string; page_width: number; page_height: number }>(
    "/render",
    { pdf_url: pdfUrl, page_index: pageIndex },
  );
}

/** Encola el conteo; devuelve el job. */
export function engineAnalyze(
  pdfUrl: string,
  systemType: string,
  symbols: EngineSymbol[],
) {
  return call<{ id: string; status: string }>("/analyze", {
    pdf_url: pdfUrl,
    system_type: systemType,
    symbols,
  });
}

type JobResp = {
  id: string;
  status: "encolado" | "procesando" | "listo" | "error";
  progress: string | null;
  result: EngineAnalyzeResult | null;
  error: string | null;
};

/** Espera el resultado del conteo consultando el job (con timeout). */
export async function engineWaitResult(
  jobId: string,
  { timeoutMs = 240000, intervalMs = 1500 } = {},
): Promise<EngineAnalyzeResult> {
  const started = Date.now();
  // getJob usa GET; se arma aquí porque call() es POST.
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${BASE}/jobs/${jobId}`, {
      headers: { "X-Engine-Secret": SECRET },
    });
    if (!res.ok) throw new Error(`Motor job (${res.status})`);
    const job = (await res.json()) as JobResp;
    if (job.status === "listo" && job.result) return job.result;
    if (job.status === "error") throw new Error(job.error ?? "El motor falló.");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("El motor tardó demasiado en responder.");
}
