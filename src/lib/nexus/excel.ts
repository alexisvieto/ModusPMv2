// =========================================================
// Export a Excel de una cotización Nexus — hoja "Análisis de Presupuesto".
// Mantiene el branding del exportable actual (navy #0F2044 + Calibri) y escribe
// FÓRMULAS vivas en cascada, para que gerencia ajuste los % en la propia hoja.
// Client-only (usa Blob/descarga); ExcelJS entra por dynamic import.
// =========================================================

import type { CostKind, NexusParams } from "@/lib/nexus/calc";

export type ExcelItem = {
  description: string;
  manufacturer: string;
  kind: CostKind;
  qty: number;
  unit_price: number;
};
export type ExcelLabor = {
  profile_name: string;
  personas: number;
  dias: number;
  daily_rate: number;
};
export type ExcelCategory = {
  name: string;
  items: ExcelItem[];
  labor: ExcelLabor[];
};
export type ExcelData = {
  name: string;
  client: string;
  odoo_code: string;
  elaborated_by: string;
  date: string;
  params: NexusParams;
  categories: ExcelCategory[];
};

// Paleta del exportable (ARGB).
const NAVY = "FF0F2044";
const BLUE = "FF1A3460";
const ALT = "FFF0F4FF";
const WHITE = "FFFFFFFF";
const GRAY = "FF999999";
const FONT = "Calibri";
const ACC =
  '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WS = any;

// Construye el workbook (sin DOM) — separado para poder verificarlo en tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildEstimateWorkbook(data: ExcelData): Promise<any> {
  const excelMod: { default?: unknown } = await import("exceljs");
  const ExcelJS = (excelMod.default ?? excelMod) as {
    Workbook: new () => Record<string, unknown>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = new ExcelJS.Workbook() as any;
  wb.creator = "Nexus · Cálculo de Proyectos";

  const ws: WS = wb.addWorksheet("Análisis de Presupuesto", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 8 }, // A Cant
    { width: 44 }, // B Descripción
    { width: 20 }, // C Fabricante
    { width: 14 }, // D Material
    { width: 14 }, // E Mano de Obra
    { width: 12 }, // F Herramienta
    { width: 10 }, // G Flete
    { width: 14 }, // H Ind. Oficina
    { width: 13 }, // I Ind. Campo
    { width: 15 }, // J Financiamiento
    { width: 13 }, // K Utilidad
    { width: 15 }, // L Subtotal
    { width: 12 }, // M ITBMS
    { width: 16 }, // N Total General
  ];

  const fillOf = (argb: string) => ({
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  });

  // ── Fila 1: banner ──
  ws.mergeCells("A1:D1");
  ws.mergeCells("E1:H1");
  ws.mergeCells("I1:K1");
  ws.mergeCells("L1:N1");
  const banner = [
    { c: "A1", v: data.name || "Cotización", sz: 12 },
    {
      c: "E1",
      v: `Cliente: ${data.client || "—"}${data.odoo_code ? `   ·   Odoo: ${data.odoo_code}` : ""}`,
      sz: 10,
    },
    { c: "I1", v: `Elaborado: ${data.elaborated_by || "—"}`, sz: 10 },
    { c: "L1", v: `Fecha: ${data.date}`, sz: 10 },
  ];
  for (const b of banner) {
    const cell = ws.getCell(b.c);
    cell.value = b.v;
    cell.font = { name: FONT, bold: true, size: b.sz, color: { argb: WHITE } };
    cell.fill = fillOf(NAVY);
    cell.alignment = { vertical: "middle" };
  }
  ws.getRow(1).height = 22;

  // ── Fila 2: parámetros (fracciones, formato 0%) que referencian las fórmulas ──
  const p = data.params;
  ws.mergeCells("A2:C2");
  const hint = ws.getCell("A2");
  hint.value = "↓ parámetros";
  hint.font = { name: FONT, size: 8, color: { argb: GRAY } };
  const paramCells: [string, number][] = [
    ["H2", p.ind_oficina],
    ["I2", p.ind_campo],
    ["J2", p.financiamiento],
    ["K2", p.utilidad],
    ["M2", p.itbms],
  ];
  for (const [addr, val] of paramCells) {
    const c = ws.getCell(addr);
    c.value = val;
    c.numFmt = "0%";
    c.font = { name: FONT, bold: true, size: 9, color: { argb: "FF595959" } };
  }

  // ── Fila 3: encabezados ──
  const heads = [
    "Cant.", "Descripción", "Fabricante", "Material", "Mano de Obra",
    "Herramienta", "Flete", "Ind. Oficina", "Ind. Campo", "Financiamiento",
    "Utilidad", "Subtotal", "ITBMS", "Total General",
  ];
  const hr = ws.getRow(3);
  heads.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true, size: 9, color: { argb: WHITE } };
    c.fill = fillOf(NAVY);
    c.alignment = { vertical: "middle", wrapText: true };
  });

  // Fórmulas de cascada para una fila r (directos D:G ya presentes).
  const cascade = (r: number) => ({
    H: { formula: `SUM(D${r}:G${r})*H$2` },
    I: { formula: `SUM(D${r}:G${r})*I$2` },
    J: { formula: `SUM(D${r}:I${r})*J$2` },
    K: { formula: `SUM(D${r}:J${r})*K$2` },
    L: { formula: `SUM(D${r}:K${r})` },
    M: { formula: `L${r}*M$2` },
    N: { formula: `L${r}+M${r}` },
  });
  const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
  const numCols = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
  const bucketCol = (kind: CostKind) =>
    kind === "Material" ? "D" : kind === "ManoDeObra" ? "E" : kind === "Herramienta" ? "F" : "G";

  let r = 4;
  const catRows: number[] = [];

  for (const cat of data.categories) {
    const catRow = r;
    catRows.push(catRow);
    r++;
    const firstItem = r;

    // ítems
    for (const it of cat.items) {
      const row = ws.getRow(r);
      row.getCell(1).value = it.qty;
      row.getCell(2).value = it.description;
      row.getCell(3).value = it.manufacturer || "";
      row.getCell(COLS.indexOf(bucketCol(it.kind)) + 1).value = it.qty * it.unit_price;
      const f = cascade(r);
      row.getCell(8).value = f.H;
      row.getCell(9).value = f.I;
      row.getCell(10).value = f.J;
      row.getCell(11).value = f.K;
      row.getCell(12).value = f.L;
      row.getCell(13).value = f.M;
      row.getCell(14).value = f.N;
      r++;
    }
    // mano de obra
    for (const l of cat.labor) {
      const row = ws.getRow(r);
      row.getCell(1).value = "-";
      row.getCell(2).value = `Mano de Obra — ${l.profile_name} (${l.personas}p × ${l.dias}d × $${l.daily_rate.toFixed(2)}/día)`;
      row.getCell(5).value = l.personas * l.dias * l.daily_rate; // E = Mano de Obra
      const f = cascade(r);
      row.getCell(8).value = f.H;
      row.getCell(9).value = f.I;
      row.getCell(10).value = f.J;
      row.getCell(11).value = f.K;
      row.getCell(12).value = f.L;
      row.getCell(13).value = f.M;
      row.getCell(14).value = f.N;
      r++;
    }
    const lastItem = r - 1;

    // Encabezado de categoría (fila catRow): nombre + sumas de directos + cascada.
    ws.mergeCells(`A${catRow}:C${catRow}`);
    const nameCell = ws.getCell(`A${catRow}`);
    nameCell.value = cat.name;
    for (let ci = 1; ci <= 14; ci++) {
      const c = ws.getRow(catRow).getCell(ci);
      c.fill = fillOf(BLUE);
      c.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
    }
    if (lastItem >= firstItem) {
      for (const col of ["D", "E", "F", "G"]) {
        ws.getCell(`${col}${catRow}`).value = {
          formula: `SUM(${col}${firstItem}:${col}${lastItem})`,
        };
      }
    }
    const cf = cascade(catRow);
    ws.getCell(`H${catRow}`).value = cf.H;
    ws.getCell(`I${catRow}`).value = cf.I;
    ws.getCell(`J${catRow}`).value = cf.J;
    ws.getCell(`K${catRow}`).value = cf.K;
    ws.getCell(`L${catRow}`).value = cf.L;
    ws.getCell(`M${catRow}`).value = cf.M;
    ws.getCell(`N${catRow}`).value = cf.N;
  }

  // Zebra + fuente + formato contable en las filas de ítems (entre 4 y r-1).
  for (let rr = 4; rr < r; rr++) {
    if (catRows.includes(rr)) continue;
    const row = ws.getRow(rr);
    const isAlt = (rr - 4) % 2 === 1;
    for (let ci = 1; ci <= 14; ci++) {
      const c = row.getCell(ci);
      if (!c.font) c.font = { name: FONT, size: 10 };
      if (isAlt) c.fill = fillOf(ALT);
    }
  }

  // Formato contable en todas las columnas numéricas (ítems + categorías).
  for (let rr = 4; rr < r; rr++) {
    for (const col of numCols) ws.getCell(`${col}${rr}`).numFmt = ACC;
  }

  // ── Fila TOTAL GENERAL ──
  const totalRow = r + 1;
  ws.mergeCells(`A${totalRow}:C${totalRow}`);
  const tc = ws.getCell(`A${totalRow}`);
  tc.value = "TOTAL GENERAL DEL PROYECTO";
  for (let ci = 1; ci <= 14; ci++) {
    const c = ws.getRow(totalRow).getCell(ci);
    c.fill = fillOf(NAVY);
    c.font = { name: FONT, bold: true, size: 11, color: { argb: WHITE } };
  }
  for (const col of numCols) {
    const cell = ws.getCell(`${col}${totalRow}`);
    cell.value = catRows.length
      ? { formula: catRows.map((cr) => `${col}${cr}`).join("+") }
      : 0;
    cell.numFmt = ACC;
  }

  return wb;
}

export async function exportEstimateExcel(data: ExcelData) {
  const wb = await buildEstimateWorkbook(data);
  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = (data.name || "Cotizacion").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  a.download = `Nexus_${safe}_${data.date}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
