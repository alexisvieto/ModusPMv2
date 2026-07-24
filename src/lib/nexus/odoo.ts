// =========================================================
// Cliente Odoo JSON-RPC — SOLO servidor (maneja la API key del tenant).
// Nunca importar desde un componente cliente. Usa el endpoint /jsonrpc que
// existe en todas las versiones de Odoo (Online, .sh y self-hosted).
// =========================================================

export type OdooConn = { url: string; db: string; login: string; key: string };

function endpoint(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) throw new Error("La URL de Odoo debe empezar con https://");
  return `${u}/jsonrpc`;
}

// Llamada JSON-RPC cruda a un servicio de Odoo (common | object).
async function rpc(
  url: string,
  service: string,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const res = await fetch(endpoint(url), {
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
    throw new Error("Autenticación rechazada: revisá base de datos, usuario y API key.");
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
      { fields: ["id", "name", "state"], limit: 1 },
    )) as { id: number; name: string; state: string }[];

    if (!found.length) {
      return {
        ok: false,
        error: `No encontré la cotización ${opts.odooCode} en Odoo. Creála primero en Odoo.`,
      };
    }
    const order = found[0];

    // (5,0,0) borra las líneas existentes; (0,0,{...}) agrega las nuevas.
    const commands: unknown[] = [[5, 0, 0]];
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
