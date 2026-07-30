// Datos iniciales (vacíos) por código de formato. El motor guarda `data` genérico;
// cada formato define su forma. Al agregar un formato nuevo, se registra aquí.
import { emptyMinuta } from "./minuta";
import { emptyVtF004 } from "./vtf004";
import { emptySiteSurvey } from "@/lib/operaciones/site-survey";

export function emptyDataForCode(code: string): unknown {
  if (code === "VT-F-004") return emptyVtF004();
  if (code === "PY-F-014") return emptySiteSurvey();
  return emptyMinuta(); // VT-F-003 por defecto
}
