// Nexus HSE — tipos de permiso de trabajo + plantillas de checklist.
// Las plantillas se conservan TAL CUAL de la app original (IS Safety): son
// conocimiento del dominio (Panamá / ISO 9001·14001) ya validado en campo.

import {
  ArrowUpFromLine,
  Blocks,
  Flame,
  HardHat,
  MoveVertical,
  RadioTower,
  type LucideIcon,
} from "lucide-react";

export type PermitTypeKey =
  | "altura_general"
  | "altura"
  | "altura_torres"
  | "altura_escalera"
  | "izaje"
  | "caliente";

export type PermitTypeMeta = {
  label: string;
  icon: LucideIcon;
  titulo: string;
  grupo?: "altura";
};

export const TIPO_PERMISOS: Record<PermitTypeKey, PermitTypeMeta> = {
  altura_general: { label: "Altura (General)", icon: HardHat, titulo: "PERMISO PARA TRABAJO EN ALTURA (GENERAL)", grupo: "altura" },
  altura: { label: "Alturas (Andamios)", icon: Blocks, titulo: "PERMISO PARA TRABAJO EN ALTURAS (ANDAMIOS)", grupo: "altura" },
  altura_torres: { label: "Alturas (Torres)", icon: RadioTower, titulo: "PERMISO PARA TRABAJO EN ALTURAS (TORRES)", grupo: "altura" },
  altura_escalera: { label: "Alturas (Escalera)", icon: MoveVertical, titulo: "PERMISO PARA TRABAJO EN ALTURAS (ESCALERA)", grupo: "altura" },
  izaje: { label: "Izaje de Cargas", icon: ArrowUpFromLine, titulo: "PERMISO DE TRABAJO SEGURO PARA IZAJE DE CARGAS" },
  caliente: { label: "Trabajo en Caliente", icon: Flame, titulo: "PERMISO PARA TRABAJO SEGURO EN CALIENTE" },
};

export type PermitGroupKey = "altura" | "izaje" | "caliente";
export const GRUPOS_PERMISOS: Record<
  PermitGroupKey,
  { label: string; icon: LucideIcon; subtipos?: PermitTypeKey[] }
> = {
  altura: { label: "Trabajo en Alturas", icon: HardHat, subtipos: ["altura_general", "altura", "altura_torres", "altura_escalera"] },
  izaje: { label: "Izaje de Cargas", icon: ArrowUpFromLine },
  caliente: { label: "Trabajo en Caliente", icon: Flame },
};

export const SUBTIPO_LABELS: Record<string, { label: string; desc: string }> = {
  altura_general: { label: "General", desc: "Trabajo en altura general (a más de 1.80 m)" },
  altura: { label: "Andamios", desc: "Montaje y trabajo sobre andamios" },
  altura_torres: { label: "Torres", desc: "Ascenso y trabajo en torres de telecomunicaciones" },
  altura_escalera: { label: "Escalera", desc: "Trabajo con escaleras fijas o portátiles" },
};

export type ChecklistSection = { seccion: string; items: string[] };

export const CHECKLIST_TEMPLATES: Record<PermitTypeKey, ChecklistSection[]> = {
  altura_general: [
    { seccion: "1. Preparación y Evaluación Previa", items: [
      "Condiciones climáticas evaluadas: sin lluvia, tormenta eléctrica ni vientos superiores a 40 km/h",
      "Área de trabajo y puntos de anclaje evaluados (estructura estable y con capacidad de soporte)",
      "Estado físico del trabajador verificado: sin fatiga, mareo, medicación que afecte el equilibrio, o consumo de alcohol/drogas",
      "Plan de rescate en alturas definido y comunicado al equipo",
      "Vigía / persona de apoyo en tierra presente durante toda la actividad",
      "Charla de seguridad previa realizada y permiso divulgado al personal",
    ]},
    { seccion: "2. EPP y Protección Contra Caídas", items: [
      "Arnés de cuerpo completo certificado y en buen estado (costuras, hebillas, anillos D)",
      "Eslinga con absorbedor de energía (máximo 1.80 m); doble eslinga para 100% de enganche",
      "Líneas de vida / puntos de anclaje certificados (5000 lb) por encima del anillo D dorsal",
      "Conectores y mosquetones de doble seguro (automáticos, acero)",
      "Casco con barbuquejo de 3 puntos y sin daños visibles",
      "Botas de seguridad antideslizantes y guantes adecuados para agarre",
    ]},
    { seccion: "3. Herramientas y Área Inferior", items: [
      "Herramientas aseguradas con cordón de retención (tool lanyard)",
      "Área inferior delimitada y señalizada (peligro caída de objetos)",
    ]},
    { seccion: "4. Durante el Trabajo", items: [
      "Conexión continua a un punto de anclaje (regla de 100% de enganche al ascender/descender)",
      "Superficie/estructura de trabajo verificada como estable antes de apoyar el peso",
      "Comunicación permanente con el vigía",
    ]},
  ],
  altura: [
    { seccion: "A. Sistemas de Protección Contra Caídas", items: [
      "Arneses de cuerpo completo en buen estado (sin desgarros ni corrosión)",
      "Eslingas de seguridad con absorbedor de choque (máximo 1.80m)",
      "Conectores y mosquetones de doble seguro (automáticos, acero, 5000 lb)",
      "Líneas de vida (verticales/horizontales) certificadas y aseguradas",
      "Freno de seguridad / Conector de tránsito vertical certificado",
    ]},
    { seccion: "B. Equipos de Acceso y Soporte", items: [
      "Andamios nivelados, asegurados cada 3 cuerpos y con ruedas frenadas",
      "Plataformas de andamios completas y sobresaliendo mínimo 30 cm",
      "Delimitación y señalización del área inferior (peligro caída de objetos)",
    ]},
    { seccion: "C. Elementos de Protección Personal (EPP)", items: [
      "Casco con barbuquejo de 3 puntos",
      "Gafas de seguridad y guantes antideslizantes/dieléctricos",
      "Protección auditiva (si el ruido supera 85 dB)",
      "Botas de seguridad con suela antideslizante",
    ]},
  ],
  altura_torres: [
    { seccion: "1. Preparación y Evaluación Previa (Campo)", items: [
      "Condiciones climáticas evaluadas: sin lluvia, tormenta eléctrica ni vientos superiores a 40 km/h",
      "Control de RF realizado: antenas apagadas o en potencia reducida en el sector de trabajo",
      "Evaluación estructural visual de la torre realizada (sin corrosión severa, pernos flojos, deformaciones)",
      "Estado físico del trabajador verificado: sin fatiga, mareo, medicación que afecte equilibrio, o consumo de alcohol/drogas",
      "Plan de rescate en alturas definido y comunicado al equipo",
      "Vigía / Persona de apoyo en tierra presente durante toda la actividad",
    ]},
    { seccion: "2. EPP y Contra Caídas", items: [
      "Arnés de cuerpo completo certificado y en buen estado (costuras, hebillas, anillos D)",
      "Línea de vida vertical con freno certificado (bloqueador o rope grab)",
      "Líneas de vida retráctiles (si aplica) inspeccionadas",
      "Eslinga de posicionamiento con absorbedor de energía",
      "Casco con barbuquejo de 3 puntos y sin daños visibles",
      "Conectores y mosquetones de doble seguro (automáticos, acero, 5000 lb mín.)",
      "Botas de seguridad y guantes adecuados para agarre",
    ]},
    { seccion: "3. Seguridad de Herramientas y Área Inferior", items: [
      "Herramientas aseguradas con cordón de retención (tool lanyard)",
      "Área inferior delimitada y señalizada (peligro caída de objetos)",
    ]},
    { seccion: "4. Procedimiento de Ascenso", items: [
      "El trabajador mantiene conexión continua a punto de anclaje (regla de 100% de enganche)",
      "Solo una persona por sección de torre (salvo que la estructura lo permita y se documente)",
      "Puntos de anclaje ubicados siempre por encima del anillo D dorsal o a la altura del hombro como mínimo",
    ]},
  ],
  altura_escalera: [
    { seccion: "A. Condiciones de la Escalera", items: [
      "Escalera en buen estado: sin peldaños rotos, fisuras ni deformaciones",
      "Zapatas antideslizantes en buen estado",
      "Escalera asegurada en la parte superior o inferior para evitar deslizamiento",
      "Ángulo de inclinación correcto (relación 4:1 — base a 1/4 de la altura)",
    ]},
    { seccion: "B. EPP y Protección Contra Caídas", items: [
      "Casco con barbuquejo de 3 puntos",
      "Arnés de cuerpo completo (si la altura supera 1.80m)",
      "Línea de vida / eslinga conectada a punto fijo",
      "Botas de seguridad con suela antideslizante",
      "Guantes adecuados para agarre",
    ]},
    { seccion: "C. Procedimiento de Uso", items: [
      "Solo una persona a la vez en la escalera",
      "Tres puntos de contacto permanentes (dos manos y un pie o dos pies y una mano)",
      "No cargar objetos pesados mientras se asciende/desciende",
      "Escalera colocada sobre superficie firme y nivelada",
      "Vigía / persona de apoyo presente en la base",
    ]},
  ],
  izaje: [
    { seccion: "A. Preparación del Área y Entorno", items: [
      "Terreno nivelado y con capacidad de soporte verificada",
      "Área de influencia demarcada y señalizada (acceso restringido)",
      "Distancia de seguridad a cables eléctricos verificada",
      "Condiciones climáticas favorables (viento < 30 km/h, sin tormenta eléctrica)",
    ]},
    { seccion: "B. Aparejos y Accesorios de Izaje", items: [
      "Eslingas de cadena y grilletes certificados y sin daños",
      "Peso de aparejos verificado y descontado de la capacidad",
      "Uso de vientos (cuerdas guía) para control de la carga",
      "Ángulo de las eslingas mantenido entre 35° y 45°",
    ]},
    { seccion: "C. Personal y Comunicación", items: [
      "Operador y Rigger con certificados de competencia vigentes",
      "Radios de comunicación en buen estado disponibles",
      "Señalero claramente visible para el operador",
      "Charla de seguridad previa y divulgación del plan realizadas",
    ]},
  ],
  caliente: [
    { seccion: "A. Preparación del Área (Control de Incendios)", items: [
      "Área libre de materiales combustibles e inflamables (radio de 11 metros)",
      "Pisos limpios (libres de aceite, grasa o polvos combustibles)",
      "Uso de mantas ignífugas para confinar chispas/proyecciones",
      "Ventilación adecuada (natural o forzada)",
    ]},
    { seccion: "B. Equipos y Herramientas", items: [
      "Máquina de soldar con cables y pinzas en buen estado (sin empalmes expuestos)",
      "Cilindros de gas verticales, asegurados y con válvulas antirretorno",
      "Mangueras de oxicorte sin grietas y con acoples técnicos",
      "Esmeriles/Pulidoras con guarda de seguridad y disco adecuado",
      "Extintor multipropósito (PQS o CO2) cargado y disponible (mín. 20 lbs)",
    ]},
    { seccion: "C. EPP Especializado", items: [
      "Careta de soldar con lente de sombra adecuada / Gafas de oxicorte",
      "Guantes de carnaza tipo soldador (manga larga)",
      "Delantal, polainas y mangas de cuero/carnaza",
      "Casco de seguridad con protección facial (si aplica)",
      "Botas de seguridad con metatarso o cuero resistente al calor",
    ]},
  ],
};

// Item del checklist ya instanciado en un permiso (con el estado marcado).
export type ChecklistItem = { texto: string; cumple: boolean | null };
export type ChecklistFilled = { seccion: string; items: ChecklistItem[] };

export function initChecklist(tipo: PermitTypeKey): ChecklistFilled[] {
  return CHECKLIST_TEMPLATES[tipo].map((sec) => ({
    seccion: sec.seccion,
    items: sec.items.map((texto) => ({ texto, cumple: null })),
  }));
}

export type PermitPersonal = { nombre: string; cedula: string; firma_path: string | null };
