"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveAiConfig, saveAiKey, clearAiKey } from "@/components/ia/actions";

type Config = {
  provider: string;
  model: string;
  monthly_budget_usd: number | null;
  is_enabled: boolean;
  api_key_set: boolean;
} | null;

type Analysis = {
  titular: string;
  estado: string;
  riesgos: string[];
  recomendaciones: string[];
};

const inputCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export function IaView({
  projectId,
  orgId,
  config,
  isAdmin,
}: {
  projectId: string;
  orgId: string;
  config: Config;
  isAdmin: boolean;
}) {
  const enabled = config?.is_enabled !== false; // por defecto activada

  // ----- Análisis ejecutivo -----
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/ai/executive-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo generar el análisis.");
        return;
      }
      setAnalysis(data as Analysis);
    } catch {
      toast.error("Error de red al generar el análisis.");
    } finally {
      setLoading(false);
    }
  }

  // ----- Config IA -----
  const [isEnabled, setIsEnabled] = useState(config?.is_enabled ?? true);
  const [provider] = useState(config?.provider ?? "anthropic");
  const [model, setModel] = useState(config?.model ?? "claude-opus-4-8");
  const [budget, setBudget] = useState(
    config?.monthly_budget_usd != null ? String(config.monthly_budget_usd) : "",
  );
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(config?.api_key_set ?? false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  async function onSaveConfig() {
    setSavingCfg(true);
    const r = await saveAiConfig(orgId, projectId, {
      provider,
      model,
      monthlyBudget: budget.trim() ? Number(budget) : null,
      isEnabled,
    });
    setSavingCfg(false);
    if (r.ok) toast.success("Configuración guardada.");
    else toast.error(r.error ?? "No se pudo guardar.");
  }

  async function onSaveKey() {
    if (!apiKey.trim()) {
      toast.error("Pega tu API key.");
      return;
    }
    setSavingKey(true);
    const r = await saveAiKey(orgId, projectId, apiKey.trim());
    setSavingKey(false);
    if (r.ok) {
      toast.success("Llave guardada de forma segura.");
      setKeySet(true);
      setApiKey("");
    } else toast.error(r.error ?? "No se pudo guardar la llave.");
  }

  async function onClearKey() {
    setSavingKey(true);
    const r = await clearAiKey(orgId, projectId);
    setSavingKey(false);
    if (r.ok) {
      toast.success("Llave eliminada.");
      setKeySet(false);
    } else toast.error(r.error ?? "No se pudo quitar la llave.");
  }

  return (
    <div className="space-y-6">
      {/* ===== Análisis Ejecutivo ===== */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Análisis Ejecutivo</h2>
                <p className="text-sm text-muted-foreground">
                  La IA lee el avance, SPI/CPI, pendientes y costos del proyecto y
                  te dice dónde estás, los riesgos y qué hacer.
                </p>
              </div>
            </div>
            <Button onClick={generate} disabled={loading || !enabled} size="sm">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {analysis ? "Regenerar" : "Generar análisis"}
            </Button>
          </div>

          {!enabled && (
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              La IA está deshabilitada para esta organización. Actívala abajo en
              Configuración.
            </div>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Analizando el proyecto…
            </div>
          )}

          {analysis && !loading && (
            <div className="mt-5 space-y-4">
              {analysis.titular && (
                <p className="text-lg font-semibold tracking-tight">
                  {analysis.titular}
                </p>
              )}
              {analysis.estado && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {analysis.estado}
                </p>
              )}

              {analysis.riesgos.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="size-4 text-warning" />
                    Riesgos
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.riesgos.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.recomendaciones.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Lightbulb className="size-4 text-primary" />
                    Recomendaciones
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.recomendaciones.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="pt-1 text-xs text-muted-foreground/70">
                Generado por IA a partir de los datos del proyecto. Revísalo antes
                de tomar decisiones.
              </p>
            </div>
          )}

          {!analysis && !loading && enabled && (
            <div className="mt-6 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Genera un diagnóstico del proyecto con un clic.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Config IA ===== */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Configuración de IA</h2>
              <p className="text-sm text-muted-foreground">
                Ajustes de IA para tu organización.
              </p>
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Solo un administrador puede cambiar la configuración de IA.
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:col-span-2">
              <span className="text-sm font-medium">IA habilitada</span>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                disabled={!isAdmin}
                className="size-4 accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Proveedor
              </label>
              <select className={inputCls} value={provider} disabled>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground/70">
                OpenAI y Google: próximamente.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Modelo
              </label>
              <input
                className={inputCls + (!isAdmin ? " cursor-not-allowed opacity-60" : "")}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="claude-opus-4-8"
                disabled={!isAdmin}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Presupuesto mensual (USD)
              </label>
              <input
                className={inputCls + (!isAdmin ? " cursor-not-allowed opacity-60" : "")}
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="Sin límite"
                disabled={!isAdmin}
              />
              <p className="mt-1 text-xs text-muted-foreground/70">
                Control de gasto mensual de IA.
              </p>
            </div>

            <div className="flex items-end">
              <Button
                onClick={onSaveConfig}
                disabled={savingCfg || !isAdmin}
                size="sm"
              >
                {savingCfg && <Loader2 className="size-4 animate-spin" />}
                Guardar configuración
              </Button>
            </div>
          </div>

          {/* API key (BYOK) */}
          <div className="mt-6 border-t pt-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4 text-muted-foreground" />
              Llave de IA (BYOK)
              {keySet && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  Configurada
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className={inputCls + (!isAdmin ? " cursor-not-allowed opacity-60" : "")}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keySet ? "•••••••• (reemplazar)" : "sk-ant-…"}
                autoComplete="off"
                disabled={!isAdmin}
              />
              <div className="flex gap-2">
                <Button
                  onClick={onSaveKey}
                  disabled={savingKey || !isAdmin}
                  size="sm"
                  variant="outline"
                >
                  {savingKey && <Loader2 className="size-4 animate-spin" />}
                  Guardar llave
                </Button>
                {keySet && (
                  <Button
                    onClick={onClearKey}
                    disabled={savingKey || !isAdmin}
                    size="sm"
                    variant="ghost"
                  >
                    Quitar
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Se guarda cifrada en Supabase Vault, nunca se muestra y solo la
              gestionan administradores. En el piloto las funciones usan la llave
              gestionada por Modus PM; la activación por-tenant se habilita en
              producción.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
