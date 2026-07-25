"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Plug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearOdooKey,
  saveOdooConfig,
  saveOdooKey,
  testOdooConnection,
} from "@/app/app/nexus/odoo-actions";

const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function OdooConfigForm({
  orgId,
  config,
}: {
  orgId: string;
  config: {
    url: string;
    db: string;
    login: string;
    default_product_id: number | null;
    api_key_set: boolean;
    is_enabled: boolean;
  };
}) {
  const [url, setUrl] = useState(config.url);
  const [db, setDb] = useState(config.db);
  const [login, setLogin] = useState(config.login);
  const [productId, setProductId] = useState(
    config.default_product_id != null ? String(config.default_product_id) : "",
  );
  const [enabled, setEnabled] = useState(config.is_enabled);
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(config.api_key_set);
  const [busy, setBusy] = useState<null | "cfg" | "key" | "test">(null);

  async function saveConfig() {
    const pid = productId.trim() ? Number(productId) : null;
    if (pid !== null && !Number.isInteger(pid)) {
      toast.error("El ID de producto Odoo debe ser un número entero.");
      return;
    }
    setBusy("cfg");
    const r = await saveOdooConfig(orgId, {
      url,
      db,
      login,
      defaultProductId: pid,
      isEnabled: enabled,
    });
    setBusy(null);
    if (r.ok) toast.success("Configuración guardada.");
    else toast.error(r.error);
  }

  async function saveKey() {
    if (!apiKey.trim()) {
      toast.error("Pegá la API key de Odoo.");
      return;
    }
    setBusy("key");
    const r = await saveOdooKey(orgId, apiKey.trim());
    setBusy(null);
    if (r.ok) {
      toast.success("API key guardada de forma segura.");
      setApiKey("");
      setKeySet(true);
    } else {
      toast.error(r.error);
    }
  }

  async function removeKey() {
    setBusy("key");
    const r = await clearOdooKey(orgId);
    setBusy(null);
    if (r.ok) {
      toast.success("API key eliminada.");
      setKeySet(false);
    } else {
      toast.error(r.error);
    }
  }

  async function test() {
    setBusy("test");
    const r = await testOdooConnection(orgId);
    setBusy(null);
    if (r.ok) toast.success(`Conexión exitosa${r.version ? ` — Odoo ${r.version}` : ""}.`);
    else toast.error(r.error ?? "No se pudo conectar.");
  }

  return (
    <div className="space-y-6">
      {/* Conexión */}
      <div className="space-y-4 rounded-lg border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">URL de Odoo</span>
            <input
              className={inp}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://odoo.ingesoft.com"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Base de datos</span>
            <input
              className={inp}
              value={db}
              onChange={(e) => setDb(e.target.value)}
              placeholder="ingesoft-prod"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Usuario (login)</span>
            <input
              className={inp}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="usuario@ingesoft.com"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Producto Odoo por defecto (ID)
            </span>
            <input
              className={inp}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Ej. 42"
              inputMode="numeric"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Habilitar el envío a Odoo
        </label>

        <Button onClick={saveConfig} disabled={busy === "cfg"}>
          {busy === "cfg" ? "Guardando…" : "Guardar configuración"}
        </Button>
      </div>

      {/* API key (Vault, write-only) */}
      <div className="space-y-3 rounded-lg border p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4 text-muted-foreground" />
          API key de Odoo
          {keySet && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" /> Configurada
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Se guarda cifrada (Vault) y nunca se muestra. La generas en Odoo →
          Preferencias → Seguridad de la cuenta → Nueva API key.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            className={inp + " max-w-xs"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keySet ? "•••••••• (reemplazar)" : "Pegá tu API key"}
            autoComplete="off"
          />
          <Button variant="outline" onClick={saveKey} disabled={busy === "key"}>
            Guardar key
          </Button>
          {keySet && (
            <Button
              variant="outline"
              onClick={removeKey}
              disabled={busy === "key"}
              className="text-destructive"
            >
              Quitar
            </Button>
          )}
        </div>
      </div>

      {/* Probar conexión */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={test} disabled={busy === "test"}>
          <Plug className="size-4" />
          {busy === "test" ? "Probando…" : "Probar conexión"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Autentica contra tu Odoo con la URL, base, usuario y API key guardados.
        </span>
      </div>
    </div>
  );
}
