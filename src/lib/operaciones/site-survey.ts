// =========================================================
// PY-F-014 — Site Survey (Operaciones). Lo llenan los ingenieros de campo.
// Mantiene el contenido del documento controlado (Datos generales, Datos del
// sitio, Detalles técnicos e informe fotográfico). Fotos por bucket (keys en data).
// =========================================================

export const PY_F_014 = "PY-F-014";

export type SurveyPhoto = { path: string; caption: string };

export type SiteSurveyData = {
  // Datos generales
  objeto_licitacion: string;
  codigo: string;
  cliente: string;
  alcance: string;
  precio_referencia: string;
  // Datos del sitio
  coord_lat: string;
  coord_lng: string;
  encargado: string;
  tipo_zona: string;
  facilidades: string;
  acceso: string;
  relieve: string;
  fotos_sitio: SurveyPhoto[];
  // Detalles técnicos e informe fotográfico
  info_general: string;
  fotos_tecnicas: SurveyPhoto[];
};

export function emptySiteSurvey(): SiteSurveyData {
  return {
    objeto_licitacion: "",
    codigo: "",
    cliente: "",
    alcance: "",
    precio_referencia: "",
    coord_lat: "",
    coord_lng: "",
    encargado: "",
    tipo_zona: "",
    facilidades: "",
    acceso: "",
    relieve: "",
    fotos_sitio: [],
    info_general: "",
    fotos_tecnicas: [],
  };
}

const photoArr = (v: unknown): SurveyPhoto[] =>
  Array.isArray(v)
    ? v
        .map((p) => ({
          path: (p as SurveyPhoto)?.path ?? "",
          caption: (p as SurveyPhoto)?.caption ?? "",
        }))
        .filter((p) => p.path)
    : [];

export function toSiteSurvey(raw: unknown): SiteSurveyData {
  const d = (raw ?? {}) as Partial<SiteSurveyData>;
  const b = emptySiteSurvey();
  return {
    objeto_licitacion: d.objeto_licitacion ?? "",
    codigo: d.codigo ?? "",
    cliente: d.cliente ?? "",
    alcance: d.alcance ?? "",
    precio_referencia: d.precio_referencia ?? "",
    coord_lat: d.coord_lat ?? "",
    coord_lng: d.coord_lng ?? "",
    encargado: d.encargado ?? "",
    tipo_zona: d.tipo_zona ?? "",
    facilidades: d.facilidades ?? "",
    acceso: d.acceso ?? "",
    relieve: d.relieve ?? "",
    fotos_sitio: photoArr(d.fotos_sitio) ?? b.fotos_sitio,
    info_general: d.info_general ?? "",
    fotos_tecnicas: photoArr(d.fotos_tecnicas) ?? b.fotos_tecnicas,
  };
}

/** Todas las keys de foto (para firmar URLs). */
export function siteSurveyPhotoPaths(d: SiteSurveyData): string[] {
  return [...d.fotos_sitio, ...d.fotos_tecnicas].map((p) => p.path);
}
