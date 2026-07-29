import { describe, it, expect } from "vitest";

import {
  buildEstimateWorkbook,
  computeDonutSegments,
  type ExcelData,
} from "@/lib/nexus/excel";

const ASSA: ExcelData = {
  name: "ASSA Control de Acceso",
  client: "ASSA",
  project_name: "Migración Keri Systems",
  odoo_code: "S00549",
  elaborated_by: "Alexis Vieto",
  date: "2026-06-23",
  params: {
    ind_oficina: 0.1,
    ind_campo: 0.02,
    financiamiento: 0.02,
    utilidad: 0.2,
    itbms: 0.07,
    itbms_compra: 0,
  },
  categories: [
    {
      name: "Control de Acceso",
      color: "#f39c12",
      duracion: 3,
      paralelo: false,
      items: [
        {
          description: "Migración Base de datos Keri Systems",
          manufacturer: "Keri",
          kind: "Material",
          qty: 1,
          unit_price: 1267.3,
        },
      ],
      labor: [
        { profile_name: "Especialista", personas: 2, dias: 3, daily_rate: 73.41 },
      ],
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formula = (v: any) => (v && typeof v === "object" ? v.formula : v);

describe("buildEstimateWorkbook — hoja Análisis de Presupuesto", () => {
  it("estructura, branding, columna Fabricante, valores directos y fórmulas cascada", async () => {
    const wb = await buildEstimateWorkbook(ASSA);
    const ws = wb.getWorksheet("Análisis de Presupuesto");
    expect(ws).toBeTruthy();

    // Columna Fabricante presente (nueva) entre Descripción y Material.
    expect(ws.getCell("B3").value).toBe("Descripción");
    expect(ws.getCell("C3").value).toBe("Fabricante");
    expect(ws.getCell("D3").value).toBe("Material");
    expect(ws.getCell("H3").value).toBe("Gastos Asoc.");
    expect(ws.getCell("O3").value).toBe("Total General");

    // Branding: header navy + Calibri.
    expect(ws.getCell("C3").fill.fgColor.argb).toBe("FF0F2044");
    expect(ws.getCell("C3").font.name).toBe("Calibri");

    // Código Odoo en el banner (relaciona el cálculo con el proyecto Odoo).
    expect(String(ws.getCell("E1").value)).toContain("S00549");

    // Parámetros en fila 2 (fracciones) — corridos por la columna Hospedaje.
    expect(ws.getCell("I2").value).toBeCloseTo(0.1, 9);
    expect(ws.getCell("N2").value).toBeCloseTo(0.07, 9);

    // Fila 4 = categoría; fila 5 = ítem; fila 6 = mano de obra.
    expect(ws.getCell("A4").value).toBe("Control de Acceso");

    // Ítem: fabricante + costo directo en Material (D).
    expect(ws.getCell("C5").value).toBe("Keri");
    expect(ws.getCell("D5").value).toBeCloseTo(1267.3, 6);

    // Mano de obra: 2 × 3 × 73.41 = 440.46 en Mano de Obra (E).
    expect(String(ws.getCell("B6").value)).toContain("Especialista");
    expect(ws.getCell("E6").value).toBeCloseTo(440.46, 6);

    // Fórmulas cascada vivas (base ahora = D:H, con Hospedaje).
    expect(formula(ws.getCell("D4").value)).toBe("SUM(D5:D6)");
    expect(formula(ws.getCell("I4").value)).toBe("SUM(D4:H4)*I$2");
    expect(formula(ws.getCell("K4").value)).toBe("SUM(D4:J4)*K$2");
    expect(formula(ws.getCell("L4").value)).toBe("SUM(D4:K4)*L$2");
    expect(formula(ws.getCell("M4").value)).toBe("SUM(D4:L4)");
    expect(formula(ws.getCell("N4").value)).toBe("M4*N$2");
    expect(formula(ws.getCell("O4").value)).toBe("M4+N4");

    // Total general (fila 8) suma las categorías.
    expect(ws.getCell("A8").value).toBe("TOTAL GENERAL DEL PROYECTO");
    expect(formula(ws.getCell("O8").value)).toBe("O4");
  });
});

describe("buildEstimateWorkbook — hojas Rentabilidad y Gantt", () => {
  it("Rentabilidad: % editables + KPIs que recalculan (what-if)", async () => {
    const wb = await buildEstimateWorkbook(ASSA);
    const wsR = wb.getWorksheet("Rentabilidad");
    expect(wsR).toBeTruthy();
    expect(String(wsR.getCell("A1").value)).toContain("RENTABILIDAD");
    // % editables (fila 6) inicializados con los parámetros de la cotización
    expect(wsR.getCell("B6").value).toBeCloseTo(0.1, 9); // ind_oficina
    expect(wsR.getCell("E6").value).toBeCloseTo(0.2, 9); // utilidad
    // Costo base vinculado a los directos de la hoja Análisis
    expect(formula(wsR.getCell("B9").value)).toContain("Análisis de Presupuesto");
    // KPIs recalculan desde los % editables (no valores fijos)
    expect(formula(wsR.getCell("B10").value)).toBe("B9*B6");
    expect(formula(wsR.getCell("B16").value)).toBe("B14+B15"); // total facturado
    expect(formula(wsR.getCell("B17").value)).toBe("IF(B14=0,0,B13/B14)"); // margen
  });

  it("Donut: 6 segmentos que suman el precio de venta", () => {
    const segs = computeDonutSegments(ASSA);
    expect(segs.map((s) => s.label)).toEqual([
      "Costo Base",
      "Ind. Oficina",
      "Ind. Campo",
      "Financiamiento",
      "Utilidad",
      "ITBMS",
    ]);
    // La suma de los segmentos = total facturado (2505.01…).
    const sum = segs.reduce((a, s) => a + s.value, 0);
    expect(sum).toBeCloseTo(2505.013410816, 6);
    // Cada segmento con color hex de 6 dígitos.
    for (const s of segs) expect(s.color).toMatch(/^[0-9A-F]{6}$/i);
  });

  it("Gantt: fila por sistema con días / inicio / fin", async () => {
    const wb = await buildEstimateWorkbook(ASSA);
    const wsG = wb.getWorksheet("Gantt");
    expect(wsG).toBeTruthy();
    expect(wsG.getCell("B6").value).toBe("Solución / Sistema");
    expect(wsG.getCell("B7").value).toBe("Control de Acceso");
    expect(wsG.getCell("D7").value).toBe(3); // días
    expect(wsG.getCell("E7").value).toBe(1); // inicio
    expect(wsG.getCell("F7").value).toBe(3); // fin = 1 + 3 - 1
  });
});

describe("buildEstimateWorkbook — hoja Costo del Proyecto + ITBMS de compra", () => {
  // Cotización con Hospedaje y 7% de compra activo.
  const CON_COMPRA: ExcelData = {
    ...ASSA,
    params: { ...ASSA.params, itbms_compra: 0.07 },
    categories: [
      {
        name: "Site Survey",
        color: "#0F2044",
        duracion: 2,
        paralelo: false,
        items: [
          { description: "Hospedaje personal", manufacturer: "", kind: "GastosAsociados", qty: 2, unit_price: 80 },
        ],
        labor: [{ profile_name: "Técnico", personas: 1, dias: 2, daily_rate: 100 }],
      },
    ],
  };

  it("hoja interna: precio proveedor + 7% = puesto en bodega", async () => {
    const wb = await buildEstimateWorkbook(CON_COMPRA);
    const wsC = wb.getWorksheet("Costo del Proyecto");
    expect(wsC).toBeTruthy();
    expect(wsC.getCell("A1").value).toContain("COSTO REAL DEL PROYECTO");
    // Tasa editable (H3) = 7%.
    expect(wsC.getCell("H3").value).toBeCloseTo(0.07, 9);
    // Fila 5 = categoría; fila 6 = ítem (Gastos Asociados).
    expect(wsC.getCell("D6").value).toBe("Gastos Asociados");
    expect(wsC.getCell("E6").value).toBeCloseTo(80, 6); // precio proveedor
    expect(formula(wsC.getCell("F6").value)).toBe("A6*E6"); // subtotal prov.
    expect(formula(wsC.getCell("G6").value)).toBe("F6*$H$3"); // ITBMS compra
    expect(formula(wsC.getCell("H6").value)).toBe("F6+G6"); // puesto en bodega
  });

  it("hoja Análisis: el costo base ya trae el 7% de compra (Gastos Asoc. 160 → 171.20)", async () => {
    const wb = await buildEstimateWorkbook(CON_COMPRA);
    const ws = wb.getWorksheet("Análisis de Presupuesto");
    // Gastos Asociados va en la columna H (fila 5 = ítem); 2 × 80 × 1.07 = 171.20.
    expect(ws.getCell("H5").value).toBeCloseTo(171.2, 6);
  });

  it("donut: el costo base incluye el 7% de compra de los Gastos Asociados", () => {
    const segs = computeDonutSegments(CON_COMPRA);
    const base = segs.find((s) => s.label === "Costo Base")!.value;
    // Hospedaje 171.20 + Mano de obra 200 = 371.20.
    expect(base).toBeCloseTo(371.2, 6);
  });
});
