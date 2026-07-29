import { describe, it, expect } from "vitest";

import {
  bucketsFrom,
  calcCascade,
  DEFAULT_PARAMS,
  margin,
  type NexusParams,
} from "@/lib/nexus/calc";

// Parámetros del Excel de ASSA (10/2/2/20/7).
const ASSA: NexusParams = {
  ind_oficina: 0.1,
  ind_campo: 0.02,
  financiamiento: 0.02,
  utilidad: 0.2,
  itbms: 0.07,
  itbms_compra: 0, // reconciliación con el Excel original (precios ya puestos en bodega)
};

describe("calcCascade — reconciliación centavo a centavo con el Excel de ASSA", () => {
  // Hoja "Análisis de Presupuesto", categoría Control de Acceso:
  // Material=1267.30, Mano de Obra=440.46, Herramienta=0, Flete=0.
  const bd = calcCascade(
    { material: 1267.3, manoObra: 440.46, herramienta: 0, flete: 0, gastosAsociados: 0 },
    ASSA,
  );

  it("base = Material + M.O. + Herram. + Flete", () => {
    expect(bd.base).toBeCloseTo(1707.76, 6);
  });
  it("Ind. Oficina = base × 10%", () => {
    expect(bd.indOficina).toBeCloseTo(170.776, 6);
  });
  it("Ind. Campo = base × 2%", () => {
    expect(bd.indCampo).toBeCloseTo(34.1552, 6);
  });
  it("Financiamiento = (base + indirectos) × 2% (cascada)", () => {
    expect(bd.financiamiento).toBeCloseTo(38.253824, 6);
  });
  it("Utilidad = (base + indir + financ) × 20% (cascada)", () => {
    expect(bd.utilidad).toBeCloseTo(390.1890048, 6);
  });
  it("Subtotal sin ITBMS", () => {
    expect(bd.subtotal).toBeCloseTo(2341.1340288, 6);
  });
  it("ITBMS = subtotal × 7%", () => {
    expect(bd.itbms).toBeCloseTo(163.879382016, 6);
  });
  it("TOTAL GENERAL = 2505.013410816 (celda M13)", () => {
    expect(bd.total).toBeCloseTo(2505.013410816, 6);
  });
  it("Margen de utilidad = utilidad / subtotal ≈ 16.67%", () => {
    expect(margin(bd)).toBeCloseTo(0.16666666, 6);
  });
});

describe("bucketsFrom — reparto por tipo + mano de obra por perfil", () => {
  it("suma qty×precio en el bucket del tipo y M.O. por perfil", () => {
    const b = bucketsFrom(
      [
        { kind: "Material", qty: 150, unit_price: 3.25 }, // 487.50
        { kind: "Material", qty: 2, unit_price: 14.9 }, // 29.80
        { kind: "Flete", qty: 1, unit_price: 40 }, // 40
      ],
      [{ personas: 1, dias: 3, daily_rate: 73.41 }], // 220.23 a M.O.
    );
    expect(b.material).toBeCloseTo(517.3, 6);
    expect(b.flete).toBeCloseTo(40, 6);
    expect(b.manoObra).toBeCloseTo(220.23, 6);
    expect(b.herramienta).toBe(0);
  });

  it("es lineal: total agregado == suma de los por-ítem", () => {
    const items = [
      { kind: "Material" as const, qty: 10, unit_price: 5 },
      { kind: "ManoDeObra" as const, qty: 1, unit_price: 200 },
    ];
    const agg = calcCascade(bucketsFrom(items), DEFAULT_PARAMS).total;
    const perItem = items
      .map((it) => calcCascade(bucketsFrom([it]), DEFAULT_PARAMS).total)
      .reduce((a, b) => a + b, 0);
    expect(agg).toBeCloseTo(perItem, 9);
  });
});

describe("ITBMS de compra (costo real) + Gastos Asociados", () => {
  it("suma el 7% al precio del proveedor en todo lo comprado", () => {
    const b = bucketsFrom(
      [
        { kind: "Material", qty: 1, unit_price: 100 }, // 107
        { kind: "Herramienta", qty: 1, unit_price: 50 }, // 53.50
        { kind: "Flete", qty: 1, unit_price: 200 }, // 214
        { kind: "GastosAsociados", qty: 2, unit_price: 80 }, // 160 → 171.20
      ],
      [],
      0.07,
    );
    expect(b.material).toBeCloseTo(107, 6);
    expect(b.herramienta).toBeCloseTo(53.5, 6);
    expect(b.flete).toBeCloseTo(214, 6);
    expect(b.gastosAsociados).toBeCloseTo(171.2, 6);
  });

  it("la Mano de Obra NO lleva ITBMS de compra", () => {
    const b = bucketsFrom(
      [{ kind: "ManoDeObra", qty: 1, unit_price: 500 }],
      [{ personas: 2, dias: 3, daily_rate: 100 }], // 600
      0.07,
    );
    expect(b.manoObra).toBeCloseTo(1100, 6); // 500 + 600, sin recargo
  });

  it("con tasa 0 el costo queda igual al precio del proveedor (existentes)", () => {
    const b = bucketsFrom([{ kind: "GastosAsociados", qty: 1, unit_price: 80 }], [], 0);
    expect(b.gastosAsociados).toBeCloseTo(80, 6);
  });

  it("un tipo antiguo (Hospedaje) cae en Gastos Asociados y lleva el 7%", () => {
    // Robustez: kinds legados no se pierden — el `else` los enruta al cajón general.
    const b = bucketsFrom(
      [{ kind: "Hospedaje" as unknown as "GastosAsociados", qty: 1, unit_price: 100 }],
      [],
      0.07,
    );
    expect(b.gastosAsociados).toBeCloseTo(107, 6);
  });
});
