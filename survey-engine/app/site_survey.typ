// Nexus Operaciones — Site Survey (PY-F-014). Editorial, marca por tenant.
// Fotos por images/* (el motor las descarga y las acomoda solas en grilla).

#let data = json("data.json")
#let brand = data.brand
#let s = data.s

#let navy = rgb(brand.dark)
#let accent = rgb(brand.primary)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: "Site Survey — " + s.record_label)
#set text(font: ("Liberation Sans", "DejaVu Sans"), size: 9.5pt, fill: rgb("#2D2D2D"))
#set par(justify: false, leading: 0.6em)

#set page(
  paper: "a4",
  margin: (x: 1.6cm, top: 3.5cm, bottom: 2.4cm),
  header: context {
    set text(size: 8.5pt, fill: muted)
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      [#if brand.logo != "" [#box(image(brand.logo, height: 1.4cm))] else [#text(weight: "bold", size: 12pt, fill: navy)[#brand.name]]],
      [
        #text(weight: "bold", fill: navy, size: 9pt)[SITE SURVEY] \
        #brand.legal_name — #s.codigo_formato (v#s.version)
      ],
    )
    v(3pt)
    line(length: 100%, stroke: 0.5pt + hair)
  },
  footer: context {
    line(length: 100%, stroke: 0.5pt + hair)
    v(3pt)
    set text(size: 7.5pt, fill: muted)
    grid(
      columns: (1fr, auto),
      align: (left + top, right + bottom),
      [
        #{
          let parts = (s.codigo_formato,)
          if brand.website != "" { parts.push(brand.website) }
          parts.join("  ·  ")
        }
        #if brand.credit [ \ #text(size: 7pt)[Un producto de Nexera — www.nexerai.io]]
      ],
      [Página #counter(page).display() de #counter(page).final().first()],
    )
  },
)

#let sec(t) = block(width: 100%, fill: navy, inset: (x: 8pt, y: 5pt), radius: 3pt)[
  #text(fill: white, weight: "bold", size: 10pt)[#t]
]
#let label(t) = text(fill: muted, size: 8.5pt)[#t]
#let dash(v) = if v != "" [#v] else [—]
#let fotogrid(fotos) = if fotos.len() > 0 {
  grid(
    columns: (1fr, 1fr),
    gutter: 8pt,
    ..fotos.map(f => box(width: 100%)[
      #box(width: 100%, clip: true, radius: 4pt, stroke: 0.5pt + hair)[
        #image(f.path, width: 100%, height: 5cm, fit: "cover")
      ]
      #if f.caption != "" [#v(2pt) #text(size: 8pt, fill: muted)[#f.caption]]
    ]),
  )
} else [#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#text(fill: muted)[Sin fotografías]]]

// ── Título ──
#align(center)[#text(size: 16pt, weight: "bold", fill: navy)[Site Survey]]
#v(3pt)
#align(center)[
  #box(fill: accent.transparentize(85%), inset: (x: 10pt, y: 3pt), radius: 10pt)[
    #text(size: 9.5pt, weight: "bold", fill: accent)[#s.record_label]
  ]
]
#v(10pt)

// ── 1. Datos Generales ──
#sec[1. Datos Generales]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Objeto de la licitación], [#dash(s.objeto_licitacion)],
    label[Código], [#dash(s.codigo)],
    label[Cliente], [#dash(s.cliente)],
    label[Alcance], [#dash(s.alcance)],
    label[Precio de referencia], [#dash(s.precio_referencia)],
  )
]
#v(10pt)

// ── 2. Datos del Sitio ──
#sec[2. Datos del Sitio]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Latitud], [#dash(s.coord_lat)], label[Longitud], [#dash(s.coord_lng)],
    label[Encargado del sitio], grid.cell(colspan: 3)[#dash(s.encargado)],
    label[Tipo de zona], [#dash(s.tipo_zona)], label[Facilidades], [#dash(s.facilidades)],
    label[Acceso], [#dash(s.acceso)], label[Relieve], [#dash(s.relieve)],
  )
]
#v(8pt)
#text(weight: "bold", size: 9.5pt, fill: navy)[Fotografías del sitio]
#v(4pt)
#fotogrid(data.fotos_sitio)
#v(10pt)

// ── 3. Detalles técnicos e informe fotográfico ──
#sec[3. Detalles técnicos e informe fotográfico]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #label[Información general] \
  #if s.info_general != "" [#s.info_general] else [#text(fill: muted)[—]]
]
#v(8pt)
#text(weight: "bold", size: 9.5pt, fill: navy)[Informe fotográfico]
#v(4pt)
#fotogrid(data.fotos_tecnicas)
#v(16pt)

// ── Firma ──
#grid(
  columns: (1fr, 1fr),
  column-gutter: 24pt,
  [
    #line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
    #v(2pt)
    #label[Elaborado por] \
    #text(weight: "bold")[#dash(s.elaborado_por)]
  ],
  [
    #line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
    #v(2pt)
    #label[Fecha] \
    #text(weight: "bold")[#dash(s.elaborado_fecha)]
  ],
)
