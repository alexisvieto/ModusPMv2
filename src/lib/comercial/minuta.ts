// =========================================================
// Formato VT-F-003 — Minuta de visita a clientes.
// El código de formato es FIJO (VT-F-003); el nº de visita lo genera el motor.
// Estos son los campos que pide el formato (van en doc_records.data).
// =========================================================

export const VT_F_003 = "VT-F-003";

export type Participante = { nombre: string; cargo: string; empresa: string };
export type Acuerdo = { descripcion: string; responsable: string };

export type MinutaData = {
  cliente: string;
  contacto: string;
  cargo: string;
  fecha_visita: string; // YYYY-MM-DD
  tema_reunion: string;
  participantes: Participante[];
  temas_tratados: string[];
  acuerdos: Acuerdo[];
  proxima_reunion: string; // fecha o "N/A"
  observaciones: string;
};

export function emptyMinuta(): MinutaData {
  return {
    cliente: "",
    contacto: "",
    cargo: "",
    fecha_visita: "",
    tema_reunion: "",
    participantes: [{ nombre: "", cargo: "", empresa: "" }],
    temas_tratados: [""],
    acuerdos: [{ descripcion: "", responsable: "" }],
    proxima_reunion: "N/A",
    observaciones: "",
  };
}

// Normaliza cualquier JSON guardado a la forma completa (tolerante a faltantes).
export function toMinuta(raw: unknown): MinutaData {
  const d = (raw ?? {}) as Partial<MinutaData>;
  const base = emptyMinuta();
  return {
    cliente: d.cliente ?? "",
    contacto: d.contacto ?? "",
    cargo: d.cargo ?? "",
    fecha_visita: d.fecha_visita ?? "",
    tema_reunion: d.tema_reunion ?? "",
    participantes:
      Array.isArray(d.participantes) && d.participantes.length
        ? d.participantes.map((p) => ({
            nombre: p?.nombre ?? "",
            cargo: p?.cargo ?? "",
            empresa: p?.empresa ?? "",
          }))
        : base.participantes,
    temas_tratados:
      Array.isArray(d.temas_tratados) && d.temas_tratados.length
        ? d.temas_tratados.map((t) => String(t ?? ""))
        : base.temas_tratados,
    acuerdos:
      Array.isArray(d.acuerdos) && d.acuerdos.length
        ? d.acuerdos.map((a) => ({
            descripcion: a?.descripcion ?? "",
            responsable: a?.responsable ?? "",
          }))
        : base.acuerdos,
    proxima_reunion: d.proxima_reunion ?? "N/A",
    observaciones: d.observaciones ?? "",
  };
}
