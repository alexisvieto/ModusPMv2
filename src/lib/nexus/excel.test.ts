import { describe, it, expect } from "vitest";

import { buildEstimateWorkbook, type ExcelData } from "@/lib/nexus/excel";

const ASSA: ExcelData = {
  name: "ASSA Control de Acceso",
  client: "ASSA",
  odoo_code: "S00549",
  elaborated_by: "Alexis Vieto",
  date: "2026-06-23",
  params: {
    ind_oficina: 0.1,
    ind_campo: 0.02,
    financiamiento: 0.02,
    utilidad: 0.2,
    itbms: 0.07,
  },
  categories: [
    {
      name: "Control de Acceso",
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
    expect(ws.getCell("N3").value).toBe("Total General");

    // Branding: header navy + Calibri.
    expect(ws.getCell("C3").fill.fgColor.argb).toBe("FF0F2044");
    expect(ws.getCell("C3").font.name).toBe("Calibri");

    // Código Odoo en el banner (relaciona el cálculo con el proyecto Odoo).
    expect(String(ws.getCell("E1").value)).toContain("S00549");

    // Parámetros en fila 2 (fracciones).
    expect(ws.getCell("H2").value).toBeCloseTo(0.1, 9);
    expect(ws.getCell("M2").value).toBeCloseTo(0.07, 9);

    // Fila 4 = categoría; fila 5 = ítem; fila 6 = mano de obra.
    expect(ws.getCell("A4").value).toBe("Control de Acceso");

    // Ítem: fabricante + costo directo en Material (D).
    expect(ws.getCell("C5").value).toBe("Keri");
    expect(ws.getCell("D5").value).toBeCloseTo(1267.3, 6);

    // Mano de obra: 2 × 3 × 73.41 = 440.46 en Mano de Obra (E).
    expect(String(ws.getCell("B6").value)).toContain("Especialista");
    expect(ws.getCell("E6").value).toBeCloseTo(440.46, 6);

    // Fórmulas cascada vivas.
    expect(formula(ws.getCell("D4").value)).toBe("SUM(D5:D6)");
    expect(formula(ws.getCell("H4").value)).toBe("SUM(D4:G4)*H$2");
    expect(formula(ws.getCell("J4").value)).toBe("SUM(D4:I4)*J$2");
    expect(formula(ws.getCell("K4").value)).toBe("SUM(D4:J4)*K$2");
    expect(formula(ws.getCell("L4").value)).toBe("SUM(D4:K4)");
    expect(formula(ws.getCell("M4").value)).toBe("L4*M$2");
    expect(formula(ws.getCell("N4").value)).toBe("L4+M4");

    // Total general (fila 8) suma las categorías.
    expect(ws.getCell("A8").value).toBe("TOTAL GENERAL DEL PROYECTO");
    expect(formula(ws.getCell("N8").value)).toBe("N4");
  });
});
