// =========================================================
// Cliente Odoo JSON-RPC — SOLO servidor (maneja la API key del tenant).
// Nunca importar desde un componente cliente. Usa el endpoint /jsonrpc que
// existe en todas las versiones de Odoo (Online, .sh y self-hosted).
// =========================================================

import { lookup } from "node:dns/promises";

export type OdooConn = { url: string; db: string; login: string; key: string };

function endpoint(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) throw new Error("La URL de Odoo debe empezar con https://");
  return `${u}/jsonrpc`;
}

// Anti-SSRF: la URL de Odoo la define un admin del tenant; se rechaza si
// resuelve a una dirección de red interna (metadata, loopback, RFC1918…).
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    return m ? isPrivateIp(m[1]) : false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertSafeHost(url: string): Promise<void> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (host.toLowerCase() === "localhost") {
    throw new Error("La URL de Odoo no puede apuntar a la red interna.");
  }
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  const addrs = isIpLiteral
    ? [host]
    : (await lookup(host, { all: true })).map((r) => r.address);
  if (addrs.some(isPrivateIp)) {
    throw new Error("La URL de Odoo no puede apuntar a la red interna.");
  }
}

// Llamada JSON-RPC cruda a un servicio de Odoo (common | object).
async function rpc(
  url: string,
  service: string,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const ep = endpoint(url);
  await assertSafeHost(url);
  const res = await fetch(ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: 1,
    }),
    // Odoo puede tardar; corta a los 20s.
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Odoo respondió HTTP ${res.status}`);
  const json = (await res.json()) as {
    result?: unknown;
    error?: { data?: { message?: string }; message?: string };
  };
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || "Error de Odoo");
  }
  return json.result;
}

async function authenticate(c: OdooConn): Promise<number> {
  const uid = (await rpc(c.url, "common", "authenticate", [
    c.db,
    c.login,
    c.key,
    {},
  ])) as number | false;
  if (!uid || typeof uid !== "number") {
    throw new Error("Autenticación rechazada: revisa base de datos, usuario y API key.");
  }
  return uid;
}

async function executeKw(
  c: OdooConn,
  uid: number,
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  return rpc(c.url, "object", "execute_kw", [c.db, uid, c.key, model, method, args, kwargs]);
}

/** Prueba la conexión: autentica y devuelve uid + versión del servidor. */
export async function testConnection(
  c: OdooConn,
): Promise<{ ok: true; uid: number; version: string } | { ok: false; error: string }> {
  try {
    const uid = await authenticate(c);
    let version = "";
    try {
      const v = (await rpc(c.url, "common", "version", [])) as { server_version?: string };
      version = v?.server_version ?? "";
    } catch {
      /* la versión es opcional */
    }
    return { ok: true, uid, version };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo conectar." };
  }
}

export type OdooLine = { name: string; price: number };

/**
 * Empuja las líneas a una cotización EXISTENTE de Odoo (buscada por su código
 * S00XXX). Reemplaza las líneas por una por categoría. price = subtotal SIN
 * ITBMS; Odoo aplica su propio impuesto según el producto/cliente.
 */
export async function pushToExistingOrder(
  c: OdooConn,
  opts: { odooCode: string; productId: number; lines: OdooLine[] },
): Promise<{ ok: true; orderId: number; orderName: string } | { ok: false; error: string }> {
  try {
    const uid = await authenticate(c);

    const found = (await executeKw(
      c,
      uid,
      "sale.order",
      "search_read",
      [[["name", "=", opts.odooCode]]],
      { fields: ["id", "name", "state"] },
    )) as { id: number; name: string; state: string }[];

    if (!found.length) {
      return {
        ok: false,
        error: `No encontré la cotización ${opts.odooCode} en Odoo. Creála primero en Odoo.`,
      };
    }
    if (found.length > 1) {
      return {
        ok: false,
        error: `Hay ${found.length} cotizaciones con el código ${opts.odooCode} en Odoo; resolvé la duplicación antes de enviar.`,
      };
    }
    const order = found[0];
    if (order.state !== "draft" && order.state !== "sent") {
      return {
        ok: false,
        error: `La cotización ${opts.odooCode} está en estado «${order.state}»; solo se puede actualizar en borrador o enviada.`,
      };
    }

    // Reemplaza SOLO las líneas creadas por Nexus (mismo producto por defecto),
    // sin tocar líneas manuales cargadas en Odoo.
    const existing = (await executeKw(
      c,
      uid,
      "sale.order.line",
      "search_read",
      [[["order_id", "=", order.id], ["product_id", "=", opts.productId]]],
      { fields: ["id"] },
    )) as { id: number }[];
    const commands: unknown[] = existing.map((l) => [2, l.id, 0]);
    for (const l of opts.lines) {
      commands.push([
        0,
        0,
        { product_id: opts.productId, name: l.name, product_uom_qty: 1, price_unit: l.price },
      ]);
    }
    await executeKw(c, uid, "sale.order", "write", [[order.id], { order_line: commands }]);

    return { ok: true, orderId: order.id, orderName: order.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar a Odoo." };
  }
}
