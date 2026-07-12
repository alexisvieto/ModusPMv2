// =========================================================
// Contenido del Centro de Ayuda (estático, curado, versionado con la app).
// Común a TODAS las organizaciones. Para agregar un artículo: añade una
// entrada aquí y sus imágenes en /public/help/. Las imágenes son opcionales
// (un paso sin imagen se muestra solo con texto).
// =========================================================

export type HelpStep = {
  text: string;
  image?: string; // ruta en /public/help, p.ej. "reportes/nuevo.png"
  note?: string; // aviso/tip breve para ese paso
};

export type HelpArticle = {
  id: string;
  category: HelpCategoryKey;
  title: string;
  summary: string;
  steps: HelpStep[];
  tips?: string[];
};

export type HelpCategoryKey =
  | "reportes"
  | "calculo"
  | "inventario"
  | "costos";

export const HELP_CATEGORIES: { key: HelpCategoryKey; label: string; icon: string }[] = [
  { key: "reportes", label: "Reportes diarios", icon: "ClipboardList" },
  { key: "calculo", label: "Cálculo de planos", icon: "Calculator" },
  { key: "inventario", label: "Inventario", icon: "Package" },
  { key: "costos", label: "Costos", icon: "Receipt" },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Reportes diarios ──
  {
    id: "reportes-crear-ia",
    category: "reportes",
    title: "Crear un reporte diario con IA",
    summary:
      "Ingresa el mínimo de datos y deja que la IA redacte el reporte profesional, listo para gerencia y cliente.",
    steps: [
      {
        text: "En el módulo Reportes diarios, pulsa “Nuevo reporte”. Se abre el editor sin crear nada todavía: el reporte se guarda recién cuando pulses Guardar.",
        image: "reportes/nuevo.png",
      },
      {
        text: "Llena los datos del día: fecha, personal en sitio y jornada. Las horas-hombre se calculan solas (personal × jornada).",
        image: "reportes/datos.png",
      },
      {
        text: "Revisa las Actividades del día. Vienen precargadas desde el cronograma (las tareas activas en esa fecha). Elimina las que no se trabajaron y anota cantidad y unidad en las ejecutadas.",
        image: "reportes/actividades.png",
        note: "Si el reporte es de una fecha atrasada, el sistema te ofrece incluir también las tareas de los días sin reporte.",
      },
      {
        text: "Escribe en “Resumen del día” lo ocurrido en tus palabras (avance, novedades, bloqueos). La IA redacta a partir de esto más las actividades.",
      },
      {
        text: "Pulsa “Redactar con IA”. En unos segundos aparece el reporte profesional en el cuadro, que puedes leer y editar antes de guardar.",
        image: "reportes/ia.png",
      },
      {
        text: "Pulsa Guardar. El reporte queda guardado y aparece el botón “Exportar reporte” para descargarlo en PDF con la marca de tu empresa.",
      },
    ],
    tips: [
      "Si intentas cerrar con cambios sin guardar, el sistema te pregunta antes de descartarlos.",
      "El reporte lo redacta la IA pensando en que lo leerá el gerente de operaciones y, si lo pide, el cliente.",
    ],
  },

  // ── Cálculo de planos ──
  {
    id: "calculo-pliego",
    category: "calculo",
    title: "Analizar el pliego de cargos",
    summary:
      "Sube el pliego (PDF) y recibe un informe con alcance, equipos, normas y un panel de riesgos económicos, antes de calcular nada.",
    steps: [
      {
        text: "En el módulo Cálculo, sección “Pliego de cargos / Memorial”, pulsa “Subir pliego” y elige el PDF. Si el proyecto no tiene pliego, usa “No existe pliego” (es reversible).",
        image: "calculo/pliego-subir.png",
      },
      {
        text: "El motor extrae el texto y la IA lo analiza por partes. Verás el progreso en vivo (“Analizando fragmentos…”).",
      },
      {
        text: "Al terminar, pulsa “Ver informe”. Encontrarás el resumen ejecutivo, los sistemas y alcance, la tabla de equipos, y el panel de riesgos con semáforo por severidad y la cita textual de cada uno.",
        image: "calculo/pliego-informe.png",
      },
      {
        text: "Exporta el informe a PDF con “Exportar informe” para circularlo al equipo.",
      },
    ],
    tips: [
      "Los sistemas que el pliego menciona se auto-sugieren como tarjetas en el módulo.",
      "El panel de riesgos detecta horarios restringidos, seguros/fianzas, lineamientos sindicales, multas y condiciones de pago cuando están en el documento.",
    ],
  },
  {
    id: "calculo-contar",
    category: "calculo",
    title: "Contar los elementos de un plano y verificar",
    summary:
      "Sube las hojas de un sistema, el motor cuenta cada elemento, y tú verificas y apruebas antes de que pase a costos.",
    steps: [
      {
        text: "Entra a la tarjeta del sistema (p.ej. Alarma contra incendio) y pulsa “Crear análisis”. Ponle un nombre.",
        image: "calculo/sistema.png",
      },
      {
        text: "Sube las hojas del plano en PDF (puedes subir varias). El motor lee la leyenda y cuenta los elementos de cada hoja.",
        image: "calculo/subir-planos.png",
      },
      {
        text: "En el visor de verificación, cada elemento detectado aparece como un marcador sobre el plano. El panel derecho lista los tipos con su contador en vivo.",
        image: "calculo/visor.png",
        note: "Marcador de borde sólido = alta confianza. Punteado = revisar. Usa “Ver solo dudosos” para saltar a los que necesitan tu ojo.",
      },
      {
        text: "Corrige lo que haga falta: haz clic en un marcador para confirmarlo, reclasificarlo o eliminarlo. Para agregar uno omitido, usa el botón “+” del tipo y haz clic en el plano.",
      },
      {
        text: "Cuando la hoja esté revisada, pulsa “Aprobar análisis”. Las cantidades quedan consolidadas y listas para el módulo de costos.",
      },
    ],
    tips: [
      "El PDF del plano no se guarda de forma permanente: al aprobar se elimina y queda solo la evidencia (imagen) y las cantidades.",
      "Puedes eliminar un análisis creado por error con el botón de papelera en la lista del sistema.",
    ],
  },

  // ── Inventario ──
  {
    id: "inventario-registrar",
    category: "inventario",
    title: "Registrar equipos y materiales",
    summary:
      "Lleva el control de los equipos del proyecto: recepción, estado, ubicación y datos de acceso iLO.",
    steps: [
      {
        text: "En Inventario, pulsa “Nuevo ítem” y completa la descripción, categoría, cantidad y ubicación.",
        image: "inventario/lista.png",
      },
      {
        text: "Para equipos con acceso remoto (servidores), abre “iLO Configuration” y registra usuario, contraseña y licencia. Estos datos se guardan cifrados y no viajan al listado.",
        image: "inventario/ilo.png",
      },
      {
        text: "Exporta el inventario a Excel con el color de marca de tu empresa desde el botón de exportar.",
      },
    ],
    tips: [
      "En el celular, el inventario se ve en tarjetas para trabajar cómodo en campo.",
    ],
  },
  {
    id: "inventario-escanear",
    category: "inventario",
    title: "Escanear equipos con la cámara",
    summary:
      "Busca un equipo por su código de barras o serial usando la cámara del teléfono o una pistola lectora.",
    steps: [
      {
        text: "Pulsa “Escanear”. Elige “Cámara” para usar la del dispositivo, o “Pistola” si tienes un lector físico.",
        image: "inventario/escanear.png",
      },
      {
        text: "Apunta al código. Al leerlo, el equipo aparece si está en el inventario; sientes una vibración y un destello verde de confirmación.",
        note: "Si el código no está registrado, te ofrece crear un ítem nuevo con ese código.",
      },
      {
        text: "Con el equipo en pantalla, cambia su estado o ubicación con un toque.",
      },
    ],
  },

  // ── Costos ──
  {
    id: "costos-importar",
    category: "costos",
    title: "Importar costos desde Excel o CSV",
    summary:
      "Trae el presupuesto desde cualquier sistema (Peachtree, Odoo, hoja propia) mapeando las columnas.",
    steps: [
      {
        text: "En Costos, pulsa “Importar” y sube el archivo Excel o CSV. La primera fila debe ser el encabezado de columnas.",
        image: "costos/tabla.png",
      },
      {
        text: "Asigna cada columna del archivo al campo correspondiente (código, descripción, categoría, presupuesto, comprometido, real).",
        image: "costos/importar.png",
      },
      {
        text: "Pulsa importar. Las partidas quedan cargadas; volver a importar el mismo código lo reemplaza (no duplica).",
      },
    ],
    tips: [
      "Los KPIs y la gráfica de arriba se calculan sobre todas las partidas, aunque la tabla muestre solo una página.",
    ],
  },
  {
    id: "costos-partida",
    category: "costos",
    title: "Agregar una partida manual",
    summary: "Crea una partida de costo directamente, sin importar un archivo.",
    steps: [
      {
        text: "Pulsa “Partida”. Se crea una partida nueva y se abre para editarla.",
        image: "costos/tabla.png",
      },
      {
        text: "Completa código, descripción, categoría y los montos de presupuesto, comprometido y real.",
      },
    ],
  },
];
