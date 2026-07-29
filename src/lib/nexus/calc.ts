// =========================================================
// Cálculo canónico de Nexus — CASCADA (la fórmula del Excel que aprueba
// gerencia). Cada cargo se acumula sobre el anterior. Es lineal en los costos
// directos, así que el total agregado == suma de los por-ítem (consistente
// entre la pantalla y el Excel).
// =========================================================

export type NexusParams = {
  ind_oficina: number; // fracción (0.10 = 10%)
  ind_campo: number;
  financiamiento: number;
  utilidad: number;
  itbms: number; // ITBMS de VENTA (el que paga el cliente sobre el subtotal)
  itbms_compra: number; // ITBMS de COMPRA (proveedor → "puesto en bodega")
};

export const DEFAULT_PARAMS: NexusParams = {
  ind_oficina: 0.1,
  ind_campo: 0.02,
  financiamiento: 0.02,
  utilidad: 0.2,
  itbms: 0.07,
  itbms_compra: 0.07,
};

// Los 5 buckets de costo directo (entrada del usuario).
// "Gastos Asociados" es el cajón general: hospedaje, alquiler de autos,
// transporte, viáticos, etc. (el detalle va en la descripción del ítem).
export type Buckets = {
  material: number;
  manoObra: number;
  herramienta: number;
  flete: number;
  gastosAsociados: number;
};

export type CostKind =
  | "Material"
  | "ManoDeObra"
  | "Herramienta"
  | "Flete"
  | "GastosAsociados";

// Todo lo que se le compra a un proveedor lleva el ITBMS de compra (7%) que
// convierte el precio del proveedor en el costo real. Lo único que NO lo lleva
// es la Mano de Obra (personal propio).
export const carriesPurchaseTax = (kind: CostKind): boolean =>
  kind !== "ManoDeObra";

export type Breakdown = {
  material: number;
  manoObra: number;
  herramienta: number;
  flete: number;
  gastosAsociados: number;
  base: number; // suma de los 5 directos (ya con el costo real)
  indOficina: number;
  indCampo: number;
  financiamiento: number;
  utilidad: number;
  subtotal: number; // base + cargos (sin ITBMS)
  itbms: number;
  total: number; // precio de venta al cliente
};

const emptyBuckets = (): Buckets => ({
  material: 0,
  manoObra: 0,
  herramienta: 0,
  flete: 0,
  gastosAsociados: 0,
});

/** Cadena en cascada sobre los buckets directos. */
export function calcCascade(b: Buckets, p: NexusParams): Breakdown {
  const base =
    b.material + b.manoObra + b.herramienta + b.flete + b.gastosAsociados;
  const indOficina = base * p.ind_oficina;
  const indCampo = base * p.ind_campo;
  const financiamiento = (base + indOficina + indCampo) * p.financiamiento;
  const utilidad =
    (base + indOficina + indCampo + financiamiento) * p.utilidad;
  const subtotal = base + indOficina + indCampo + financiamiento + utilidad;
  const itbms = subtotal * p.itbms;
  const total = subtotal + itbms;
  return {
    material: b.material,
    manoObra: b.manoObra,
    herramienta: b.herramienta,
    flete: b.flete,
    gastosAsociados: b.gastosAsociados,
    base,
    indOficina,
    indCampo,
    financiamiento,
    utilidad,
    subtotal,
    itbms,
    total,
  };
}

export type CalcItem = { kind: CostKind; qty: number; unit_price: number };
export type CalcLabor = { personas: number; dias: number; daily_rate: number };

/**
 * Reparte ítems + mano de obra por perfil en los 5 buckets directos.
 * `itbmsCompra` (fracción, ej. 0.07) se suma al precio del proveedor en los
 * tipos comprados (Material/Herramienta/Flete/Hospedaje) → costo puesto en
 * bodega. La Mano de Obra nunca lo lleva.
 */
export function bucketsFrom(
  items: CalcItem[],
  labor: CalcLabor[] = [],
  itbmsCompra = 0,
): Buckets {
  const b = emptyBuckets();
  for (const it of items) {
    const factor = carriesPurchaseTax(it.kind) ? 1 + itbmsCompra : 1;
    const amt = (Number(it.qty) || 0) * (Number(it.unit_price) || 0) * factor;
    if (it.kind === "Material") b.material += amt;
    else if (it.kind === "ManoDeObra") b.manoObra += amt;
    else if (it.kind === "Herramienta") b.herramienta += amt;
    else if (it.kind === "Flete") b.flete += amt;
    // GastosAsociados (y cualquier tipo antiguo tipo "Hospedaje") → cajón general.
    else b.gastosAsociados += amt;
  }
  for (const l of labor) {
    b.manoObra +=
      (Number(l.personas) || 0) * (Number(l.dias) || 0) * (Number(l.daily_rate) || 0);
  }
  return b;
}

export function addBuckets(a: Buckets, b: Buckets): Buckets {
  return {
    material: a.material + b.material,
    manoObra: a.manoObra + b.manoObra,
    herramienta: a.herramienta + b.herramienta,
    flete: a.flete + b.flete,
    gastosAsociados: a.gastosAsociados + b.gastosAsociados,
  };
}

/** Margen de utilidad sobre el subtotal (como lo muestra la hoja Rentabilidad). */
export function margin(bd: Breakdown): number {
  return bd.subtotal > 0 ? bd.utilidad / bd.subtotal : 0;
}
