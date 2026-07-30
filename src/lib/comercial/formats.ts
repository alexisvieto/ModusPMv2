// Datos iniciales (vacíos) por código de formato. El motor guarda `data` genérico;
// cada formato define su forma. Al agregar un formato nuevo, se registra aquí.
import { emptyMinuta } from "./minuta";
import { emptyVtF004 } from "./vtf004";

export function emptyDataForCode(code: string): unknown {
  if (code === "VT-F-004") return emptyVtF004();
  return emptyMinuta(); // VT-F-003 por defecto
}
