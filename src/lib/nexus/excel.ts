// =========================================================
// Export a Excel de una cotización Nexus — hoja "Análisis de Presupuesto".
// Mantiene el branding del exportable actual (navy #0F2044 + Calibri) y escribe
// FÓRMULAS vivas en cascada, para que gerencia ajuste los % en la propia hoja.
// Client-only (usa Blob/descarga); ExcelJS entra por dynamic import.
// =========================================================

import {
  addBuckets,
  bucketsFrom,
  calcCascade,
  carriesPurchaseTax,
  type CostKind,
  type NexusParams,
} from "@/lib/nexus/calc";
import { scheduleGantt } from "@/lib/nexus/schedule";

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
  color?: string | null;
  duracion: number;
  paralelo: boolean;
  items: ExcelItem[];
  labor: ExcelLabor[];
};
export type ExcelData = {
  name: string;
  client: string;
  project_name: string;
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
const YELL = "FFFFF2CC";
const LGRAY = "FFF4F6FB";
const DAYNAVY = "FF1F3864";
const FONT = "Calibri";
const ACC =
  '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)';

function hexToArgb(hex: string | null | undefined): string {
  const h = (hex ?? "").replace("#", "");
  if (h.length === 6) return "FF" + h.toUpperCase();
  if (h.length === 3) return "FF" + h.split("").map((c) => c + c).join("").toUpperCase();
  return "FF94A3B8";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WS = any;

// ── Donut de Rentabilidad: composición del precio de venta ──
// (ExcelJS no crea gráficas nativas; el donut se incrusta como IMAGEN).
export const DONUT_COLORS = {
  base: "1F3864",
  indOficina: "2E5FA3",
  indCampo: "4472C4",
  financiamiento: "ED7D31",
  utilidad: "FFC000",
  itbms: "C00000",
};

export type DonutSegment = { label: string; value: number; color: string };

// Puro/testeable: calcula los 6 segmentos desde los costos (cascada canónica).
export function computeDonutSegments(data: ExcelData): DonutSegment[] {
  const buckets = data.categories.reduce(
    (acc, c) =>
      addBuckets(
        acc,
        bucketsFrom(
          c.items.map((i) => ({ kind: i.kind, qty: i.qty, unit_price: i.unit_price })),
          c.labor.map((l) => ({
            personas: l.personas,
            dias: l.dias,
            daily_rate: l.daily_rate,
          })),
          data.params.itbms_compra,
        ),
      ),
    { material: 0, manoObra: 0, herramienta: 0, flete: 0, gastosAsociados: 0 },
  );
  const bd = calcCascade(buckets, data.params);
  return [
    { label: "Costo Base", value: bd.base, color: DONUT_COLORS.base },
    { label: "Ind. Oficina", value: bd.indOficina, color: DONUT_COLORS.indOficina },
    { label: "Ind. Campo", value: bd.indCampo, color: DONUT_COLORS.indCampo },
    { label: "Financiamiento", value: bd.financiamiento, color: DONUT_COLORS.financiamiento },
    { label: "Utilidad", value: bd.utilidad, color: DONUT_COLORS.utilidad },
    { label: "ITBMS", value: bd.itbms, color: DONUT_COLORS.itbms },
  ];
}

// Solo navegador (usa canvas). Devuelve el PNG del donut en base64 (sin cabecera).
export function drawDonutPng(segments: DonutSegment[]): string {
  const canvas = document.createElement("canvas");
  const W = 460;
  const H = 300;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = 110;
  const cy = 150;
  const r = 95;
  const rin = 52;
  let a0 = -Math.PI / 2;
  for (const s of segments) {
    const a1 = a0 + (s.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = "#" + s.color;
    ctx.fill();
    a0 = a1;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, rin, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#0F2044";
  ctx.textAlign = "center";
  ctx.font = "bold 12px Calibri, Arial";
  ctx.fillText("Precio venta", cx, cy - 4);
  ctx.font = "bold 13px Calibri, Arial";
  ctx.fillText(total.toLocaleString("es-PA", { maximumFractionDigits: 0 }), cx, cy + 14);
  let ly = 30;
  const lx = 235;
  ctx.textAlign = "left";
  for (const s of segments) {
    ctx.fillStyle = "#" + s.color;
    ctx.fillRect(lx, ly, 14, 14);
    ctx.fillStyle = "#333333";
    ctx.font = "12px Calibri, Arial";
    ctx.fillText(`${s.label} — ${((s.value / total) * 100).toFixed(1)}%`, lx + 20, ly + 12);
    ly += 26;
  }
  return canvas.toDataURL("image/png").split(",")[1];
}

// Construye el workbook (sin DOM) — separado para poder verificarlo en tests.
export async function buildEstimateWorkbook(
  data: ExcelData,
  opts: { donutBase64?: string } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
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
    { width: 14 }, // H Gastos Asociados
    { width: 14 }, // I Ind. Oficina
    { width: 13 }, // J Ind. Campo
    { width: 15 }, // K Financiamiento
    { width: 13 }, // L Utilidad
    { width: 15 }, // M Subtotal
    { width: 12 }, // N ITBMS
    { width: 16 }, // O Total General
  ];

  const fillOf = (argb: string) => ({
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  });

  // ── Fila 1: banner ──
  ws.mergeCells("A1:D1");
  ws.mergeCells("E1:H1");
  ws.mergeCells("I1:L1");
  ws.mergeCells("M1:O1");
  const banner = [
    { c: "A1", v: data.name || "Cotización", sz: 12 },
    {
      c: "E1",
      v: [
        `Cliente: ${data.client || "—"}`,
        data.project_name ? `Proyecto: ${data.project_name}` : "",
        data.odoo_code ? `Odoo: ${data.odoo_code}` : "",
      ]
        .filter(Boolean)
        .join("   ·   "),
      sz: 10,
    },
    { c: "I1", v: `Elaborado: ${data.elaborated_by || "—"}`, sz: 10 },
    { c: "M1", v: `Fecha: ${data.date}`, sz: 10 },
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
    ["I2", p.ind_oficina],
    ["J2", p.ind_campo],
    ["K2", p.financiamiento],
    ["L2", p.utilidad],
    ["N2", p.itbms],
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
    "Herramienta", "Flete", "Gastos Asoc.", "Ind. Oficina", "Ind. Campo",
    "Financiamiento", "Utilidad", "Subtotal", "ITBMS", "Total General",
  ];
  const hr = ws.getRow(3);
  heads.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true, size: 9, color: { argb: WHITE } };
    c.fill = fillOf(NAVY);
    c.alignment = { vertical: "middle", wrapText: true };
  });

  // Fórmulas de cascada para una fila r (directos D:H ya presentes).
  const cascade = (r: number) => ({
    I: { formula: `SUM(D${r}:H${r})*I$2` },
    J: { formula: `SUM(D${r}:H${r})*J$2` },
    K: { formula: `SUM(D${r}:J${r})*K$2` },
    L: { formula: `SUM(D${r}:K${r})*L$2` },
    M: { formula: `SUM(D${r}:L${r})` },
    N: { formula: `M${r}*N$2` },
    O: { formula: `M${r}+N${r}` },
  });
  const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
  const numCols = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
  const bucketCol = (kind: CostKind) =>
    kind === "Material"
      ? "D"
      : kind === "ManoDeObra"
        ? "E"
        : kind === "Herramienta"
          ? "F"
          : kind === "Flete"
            ? "G"
            : "H"; // Gastos Asociados (y cualquier tipo antiguo)

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
      // Costo puesto en bodega: precio proveedor + ITBMS de compra en los tipos comprados.
      const factor = carriesPurchaseTax(it.kind) ? 1 + data.params.itbms_compra : 1;
      row.getCell(COLS.indexOf(bucketCol(it.kind)) + 1).value =
        it.qty * it.unit_price * factor;
      const f = cascade(r);
      row.getCell(9).value = f.I;
      row.getCell(10).value = f.J;
      row.getCell(11).value = f.K;
      row.getCell(12).value = f.L;
      row.getCell(13).value = f.M;
      row.getCell(14).value = f.N;
      row.getCell(15).value = f.O;
      r++;
    }
    // mano de obra
    for (const l of cat.labor) {
      const row = ws.getRow(r);
      row.getCell(1).value = "-";
      row.getCell(2).value = `Mano de Obra — ${l.profile_name} (${l.personas}p × ${l.dias}d × $${l.daily_rate.toFixed(2)}/día)`;
      row.getCell(5).value = l.personas * l.dias * l.daily_rate; // E = Mano de Obra
      const f = cascade(r);
      row.getCell(9).value = f.I;
      row.getCell(10).value = f.J;
      row.getCell(11).value = f.K;
      row.getCell(12).value = f.L;
      row.getCell(13).value = f.M;
      row.getCell(14).value = f.N;
      row.getCell(15).value = f.O;
      r++;
    }
    const lastItem = r - 1;

    // Encabezado de categoría (fila catRow): nombre + sumas de directos + cascada.
    ws.mergeCells(`A${catRow}:C${catRow}`);
    const nameCell = ws.getCell(`A${catRow}`);
    nameCell.value = cat.name;
    for (let ci = 1; ci <= 15; ci++) {
      const c = ws.getRow(catRow).getCell(ci);
      c.fill = fillOf(BLUE);
      c.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
    }
    if (lastItem >= firstItem) {
      for (const col of ["D", "E", "F", "G", "H"]) {
        ws.getCell(`${col}${catRow}`).value = {
          formula: `SUM(${col}${firstItem}:${col}${lastItem})`,
        };
      }
    }
    const cf = cascade(catRow);
    ws.getCell(`I${catRow}`).value = cf.I;
    ws.getCell(`J${catRow}`).value = cf.J;
    ws.getCell(`K${catRow}`).value = cf.K;
    ws.getCell(`L${catRow}`).value = cf.L;
    ws.getCell(`M${catRow}`).value = cf.M;
    ws.getCell(`N${catRow}`).value = cf.N;
    ws.getCell(`O${catRow}`).value = cf.O;
  }

  // Zebra + fuente + formato contable en las filas de ítems (entre 4 y r-1).
  for (let rr = 4; rr < r; rr++) {
    if (catRows.includes(rr)) continue;
    const row = ws.getRow(rr);
    const isAlt = (rr - 4) % 2 === 1;
    for (let ci = 1; ci <= 15; ci++) {
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
  for (let ci = 1; ci <= 15; ci++) {
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

  // ==================== HOJA "Costo del Proyecto" ====================
  // Vista INTERNA (costo real): precio del proveedor + ITBMS de compra =
  // puesto en bodega. La hoja "Análisis de Presupuesto" ya parte de ese costo.
  const wsC: WS = wb.addWorksheet("Costo del Proyecto", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  wsC.columns = [
    { width: 8 }, // A Cant
    { width: 44 }, // B Descripción
    { width: 20 }, // C Fabricante
    { width: 14 }, // D Tipo
    { width: 15 }, // E Precio proveedor
    { width: 15 }, // F Subtotal proveedor
    { width: 14 }, // G ITBMS compra
    { width: 17 }, // H Puesto en bodega
  ];

  wsC.mergeCells("A1:H1");
  const cBanner = wsC.getCell("A1");
  cBanner.value = `COSTO REAL DEL PROYECTO  ·  ${data.name || "Cotización"}`;
  cBanner.font = { name: FONT, bold: true, size: 13, color: { argb: WHITE } };
  cBanner.fill = fillOf(NAVY);
  cBanner.alignment = { vertical: "middle" };
  wsC.getRow(1).height = 22;

  wsC.mergeCells("A2:H2");
  const cSub = wsC.getCell("A2");
  cSub.value = `Cliente: ${data.client || "—"}${data.project_name ? `   |   Proyecto: ${data.project_name}` : ""}   |   Fecha: ${data.date}`;
  cSub.font = { name: FONT, size: 10, color: { argb: "FF595959" } };
  cSub.fill = fillOf(LGRAY);

  // Nota + tasa de ITBMS de compra editable (amarillo).
  wsC.mergeCells("A3:F3");
  const cNote = wsC.getCell("A3");
  cNote.value =
    "Costo interno: precio del proveedor + ITBMS de compra = costo real. La Mano de Obra no lleva ITBMS.";
  cNote.font = { name: FONT, size: 8, color: { argb: GRAY } };
  const cRateLbl = wsC.getCell("G3");
  cRateLbl.value = "ITBMS compra →";
  cRateLbl.font = { name: FONT, bold: true, size: 9, color: { argb: "FF595959" } };
  cRateLbl.alignment = { horizontal: "right" };
  const cRate = wsC.getCell("H3");
  cRate.value = data.params.itbms_compra;
  cRate.numFmt = "0%";
  cRate.font = { name: FONT, bold: true, size: 10, color: { argb: "FF0000FF" } };
  cRate.fill = fillOf(YELL);
  cRate.alignment = { horizontal: "center" };

  const cHeads = [
    "Cant.", "Descripción", "Fabricante", "Tipo", "Precio prov.",
    "Subtotal prov.", "ITBMS compra", "Costo real",
  ];
  const cHr = wsC.getRow(4);
  cHeads.forEach((h, i) => {
    const c = cHr.getCell(i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true, size: 9, color: { argb: WHITE } };
    c.fill = fillOf(NAVY);
    c.alignment = { vertical: "middle", wrapText: true };
  });

  const KIND_LABEL: Record<CostKind, string> = {
    Material: "Material",
    ManoDeObra: "Mano de Obra",
    Herramienta: "Herramienta",
    Flete: "Flete",
    GastosAsociados: "Gastos Asociados",
  };

  let cRow = 5;
  const cCatRows: number[] = [];
  for (const cat of data.categories) {
    const catRow = cRow;
    cCatRows.push(catRow);
    cRow++;
    const firstItem = cRow;

    for (const it of cat.items) {
      const row = wsC.getRow(cRow);
      row.getCell(1).value = it.qty;
      row.getCell(2).value = it.description;
      row.getCell(3).value = it.manufacturer || "";
      row.getCell(4).value = KIND_LABEL[it.kind] ?? it.kind;
      row.getCell(5).value = it.unit_price;
      row.getCell(6).value = { formula: `A${cRow}*E${cRow}` };
      row.getCell(7).value = carriesPurchaseTax(it.kind)
        ? { formula: `F${cRow}*$H$3` }
        : 0;
      row.getCell(8).value = { formula: `F${cRow}+G${cRow}` };
      cRow++;
    }
    for (const l of cat.labor) {
      const row = wsC.getRow(cRow);
      row.getCell(1).value = "-";
      row.getCell(2).value = `Mano de Obra — ${l.profile_name} (${l.personas}p × ${l.dias}d × $${l.daily_rate.toFixed(2)}/día)`;
      row.getCell(4).value = "Mano de Obra";
      row.getCell(5).value = l.daily_rate;
      row.getCell(6).value = l.personas * l.dias * l.daily_rate;
      row.getCell(7).value = 0;
      row.getCell(8).value = { formula: `F${cRow}+G${cRow}` };
      cRow++;
    }
    const lastItem = cRow - 1;

    wsC.mergeCells(`A${catRow}:D${catRow}`);
    wsC.getCell(`A${catRow}`).value = cat.name;
    for (let ci = 1; ci <= 8; ci++) {
      const c = wsC.getRow(catRow).getCell(ci);
      c.fill = fillOf(BLUE);
      c.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
    }
    if (lastItem >= firstItem) {
      for (const col of ["F", "G", "H"]) {
        wsC.getCell(`${col}${catRow}`).value = {
          formula: `SUM(${col}${firstItem}:${col}${lastItem})`,
        };
      }
    }
  }

  // Zebra + formato contable.
  for (let rr = 5; rr < cRow; rr++) {
    if (cCatRows.includes(rr)) continue;
    const row = wsC.getRow(rr);
    const isAlt = (rr - 5) % 2 === 1;
    for (let ci = 1; ci <= 8; ci++) {
      const c = row.getCell(ci);
      if (!c.font) c.font = { name: FONT, size: 10 };
      if (isAlt) c.fill = fillOf(ALT);
    }
  }
  for (let rr = 5; rr < cRow; rr++) {
    for (const col of ["E", "F", "G", "H"]) wsC.getCell(`${col}${rr}`).numFmt = ACC;
  }

  // Costo total real del proyecto.
  const cTotalRow = cRow + 1;
  wsC.mergeCells(`A${cTotalRow}:E${cTotalRow}`);
  wsC.getCell(`A${cTotalRow}`).value = "COSTO TOTAL DEL PROYECTO (con ITBMS de compra)";
  for (let ci = 1; ci <= 8; ci++) {
    const c = wsC.getRow(cTotalRow).getCell(ci);
    c.fill = fillOf(NAVY);
    c.font = { name: FONT, bold: true, size: 11, color: { argb: WHITE } };
  }
  for (const col of ["F", "G", "H"]) {
    const cell = wsC.getCell(`${col}${cTotalRow}`);
    cell.value = cCatRows.length
      ? { formula: cCatRows.map((c2) => `${col}${c2}`).join("+") }
      : 0;
    cell.numFmt = ACC;
  }
  wsC.getCell(`H${cTotalRow}`).font = {
    name: FONT,
    bold: true,
    size: 11,
    color: { argb: "FFE8A020" },
  };

  // ==================== HOJA "Rentabilidad" ====================
  // Simulador what-if: los % (amarillo) recalculan los KPIs; el Costo Base se
  // vincula a los directos de la hoja Análisis.
  const AN = "'Análisis de Presupuesto'";
  const wsR: WS = wb.addWorksheet("Rentabilidad", {
    views: [{ showGridLines: false }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  wsR.columns = [{ width: 42 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];

  wsR.mergeCells("A1:F1");
  const rt = wsR.getCell("A1");
  rt.value = `RENTABILIDAD DEL PROYECTO  ·  ${data.name || "Cotización"}`;
  rt.font = { name: FONT, bold: true, size: 14, color: { argb: WHITE } };
  rt.fill = fillOf(NAVY);
  rt.alignment = { vertical: "middle" };
  wsR.getRow(1).height = 24;

  wsR.mergeCells("A2:F2");
  const rs = wsR.getCell("A2");
  rs.value = `Cliente: ${data.client || "—"}${data.project_name ? `   |   Proyecto: ${data.project_name}` : ""}   |   Elaborado por: ${data.elaborated_by || "—"}   |   Fecha: ${data.date}`;
  rs.font = { name: FONT, size: 10, color: { argb: "FF595959" } };
  rs.fill = fillOf(LGRAY);

  wsR.mergeCells("A4:F4");
  const rpb = wsR.getCell("A4");
  rpb.value = "▌  PARÁMETROS — modificá los % para simular escenarios";
  rpb.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
  rpb.fill = fillOf(BLUE);

  wsR.getCell("A5").value = "Editable →";
  wsR.getCell("A5").font = { name: FONT, size: 9, color: { argb: GRAY } };
  const rlab = ["Ind. Oficina", "Ind. Campo", "Financiamiento", "Utilidad", "ITBMS"];
  const rcol = ["B", "C", "D", "E", "F"];
  const pv = [p.ind_oficina, p.ind_campo, p.financiamiento, p.utilidad, p.itbms];
  rcol.forEach((col, i) => {
    const lc = wsR.getCell(`${col}5`);
    lc.value = rlab[i];
    lc.font = { name: FONT, bold: true, size: 9, color: { argb: "FF595959" } };
    lc.fill = fillOf(LGRAY);
    const vc = wsR.getCell(`${col}6`);
    vc.value = pv[i];
    vc.numFmt = "0.0%";
    vc.font = { name: FONT, bold: true, size: 11, color: { argb: "FF0000FF" } };
    vc.fill = fillOf(YELL);
  });

  wsR.mergeCells("A8:F8");
  const rab = wsR.getCell("A8");
  rab.value = "▌  ANÁLISIS DE RENTABILIDAD";
  rab.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
  rab.fill = fillOf(BLUE);

  const kpis: [number, string, string, boolean, boolean][] = [
    [9, "Costo Base (Material + M.O. + Herram. + Flete + Hospedaje)", `${AN}!D${totalRow}+${AN}!E${totalRow}+${AN}!F${totalRow}+${AN}!G${totalRow}+${AN}!H${totalRow}`, false, false],
    [10, "Indirectos de Oficina", "B9*B6", false, false],
    [11, "Indirectos de Campo", "B9*C6", false, false],
    [12, "Financiamiento", "(B9+B10+B11)*D6", false, false],
    [13, "Utilidad generada ($)", "(B9+B10+B11+B12)*E6", false, false],
    [14, "Subtotal sin ITBMS", "B9+B10+B11+B12+B13", false, false],
    [15, "ITBMS", "B14*F6", false, false],
    [16, "TOTAL FACTURADO AL CLIENTE", "B14+B15", false, true],
    [17, "Margen de Utilidad (%)", "IF(B14=0,0,B13/B14)", true, true],
  ];
  for (const [row, label, formula, pct, hi] of kpis) {
    const a = wsR.getCell(`A${row}`);
    a.value = label;
    a.font = { name: FONT, bold: hi, size: hi ? 11 : 10, color: { argb: hi ? NAVY : "FF000000" } };
    if (hi) a.fill = fillOf(YELL);
    const b = wsR.getCell(`B${row}`);
    b.value = { formula };
    b.numFmt = pct ? "0.0%" : ACC;
    b.font = { name: FONT, bold: hi, size: hi ? 12 : 10, color: { argb: hi ? NAVY : "FF000000" } };
    if (hi) b.fill = fillOf(YELL);
  }

  // Donut: composición del precio de venta (imagen, snapshot al exportar).
  if (opts.donutBase64) {
    const dTitle = wsR.getCell("H4");
    dTitle.value = "Composición del precio de venta";
    dTitle.font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } };
    const imgId = wb.addImage({ base64: opts.donutBase64, extension: "png" });
    wsR.addImage(imgId, {
      tl: { col: 7, row: 4 },
      ext: { width: 460, height: 300 },
    });
  }

  wsR.mergeCells("A19:F19");
  const rnote = wsR.getCell("A19");
  rnote.value =
    "💡  Los valores en amarillo son editables. Modificá los % de arriba para simular escenarios; el Costo Base se vincula a la hoja Análisis. (El donut es una foto al momento de exportar.)";
  rnote.font = { name: FONT, size: 8, color: { argb: GRAY } };

  // ==================== HOJA "Gantt" ====================
  const wsG: WS = wb.addWorksheet("Gantt", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Programación en días hábiles (misma lógica que la app: schedule.ts).
  const { rows: srows, totalDays } = scheduleGantt(data.categories);
  const grows = srows.map((r) => ({ ...r, color: hexToArgb(r.color) }));
  const dayCols = Math.min(60, Math.max(10, totalDays));
  const gridBorder = {
    right: { style: "thin" as const, color: { argb: "FFDCE3EF" } },
    bottom: { style: "thin" as const, color: { argb: "FFDCE3EF" } },
  };

  wsG.columns = [
    { width: 5 }, { width: 40 }, { width: 20 }, { width: 8 }, { width: 9 }, { width: 9 }, { width: 12 }, { width: 10 },
    ...Array.from({ length: dayCols }, () => ({ width: 3 })),
  ];

  wsG.mergeCells(1, 2, 1, 8);
  const gt = wsG.getCell("B1");
  gt.value = data.name || "Cotización";
  gt.font = { name: FONT, bold: true, size: 14 };
  gt.fill = fillOf(LGRAY);
  wsG.getRow(1).height = 22;

  wsG.mergeCells(2, 2, 2, 8);
  const gsub = wsG.getCell("B2");
  gsub.value = `Cliente: ${data.client || "—"}${data.project_name ? `   |   Proyecto: ${data.project_name}` : ""}   |   Elaborado por: ${data.elaborated_by || "—"}   |   Fecha: ${data.date}`;
  gsub.font = { name: FONT, size: 10, color: { argb: "FF595959" } };

  wsG.mergeCells(4, 2, 4, 8);
  const gn = wsG.getCell("B4");
  gn.value = "Duración estimada — Días hábiles (referencial para cotización)";
  gn.font = { name: FONT, size: 10, color: { argb: "FF6B7A99" } };

  const gh = ["#", "Solución / Sistema", "Recurso", "Días", "Inicio", "Fin", "Relación", "Resumen"];
  const ghr = wsG.getRow(6);
  gh.forEach((h, i) => {
    const c = ghr.getCell(i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true, size: 9, color: { argb: WHITE } };
    c.fill = fillOf(BLUE);
  });
  for (let d = 1; d <= dayCols; d++) {
    const c = ghr.getCell(8 + d);
    c.value = d;
    c.font = { name: FONT, bold: true, size: 7, color: { argb: WHITE } };
    c.fill = fillOf(DAYNAVY);
    c.alignment = { horizontal: "center" };
    c.border = gridBorder;
  }

  let gr = 7;
  grows.forEach((row, i) => {
    const rr = wsG.getRow(gr);
    rr.getCell(1).value = i + 1;
    rr.getCell(2).value = row.name;
    rr.getCell(3).value = row.recurso;
    rr.getCell(4).value = row.dur;
    rr.getCell(5).value = row.dur > 0 ? row.start : "—";
    rr.getCell(6).value = row.dur > 0 ? row.end : "—";
    rr.getCell(7).value = row.paralelo ? "Paralelo" : "Secuencial";
    rr.getCell(8).value = row.dur > 0 ? `${row.dur} d` : "—";
    for (let ci = 1; ci <= 8; ci++) rr.getCell(ci).font = { name: FONT, size: 9 };
    // grilla de días visible + barra de color en el rango del sistema
    for (let d = 1; d <= dayCols; d++) {
      const dc = rr.getCell(8 + d);
      dc.border = gridBorder;
      if (row.dur > 0 && d >= row.start && d <= row.end) dc.fill = fillOf(row.color);
    }
    gr++;
  });

  const gtr = gr + 1;
  wsG.mergeCells(gtr, 2, gtr, 7);
  const gtc = wsG.getCell(`B${gtr}`);
  gtc.value = "DURACIÓN TOTAL ESTIMADA DEL PROYECTO";
  gtc.font = { name: FONT, bold: true, size: 11, color: { argb: WHITE } };
  for (let ci = 1; ci <= 8; ci++) wsG.getRow(gtr).getCell(ci).fill = fillOf(NAVY);
  const gtv = wsG.getCell(`H${gtr}`);
  gtv.value = `${totalDays} días`;
  gtv.font = { name: FONT, bold: true, size: 11, color: { argb: "FFE8A020" } };

  const gnote = wsG.getCell(`B${gtr + 2}`);
  gnote.value =
    "* Duración referencial en días hábiles (lunes a viernes). Las fechas exactas se confirman al adjudicarse el proyecto.";
  gnote.font = { name: FONT, size: 8, color: { argb: GRAY } };

  return wb;
}

export async function exportEstimateExcel(data: ExcelData) {
  const donutBase64 = drawDonutPng(computeDonutSegments(data));
  const wb = await buildEstimateWorkbook(data, { donutBase64 });
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
