// Nexus HSE — Permiso de Trabajo (Typst). Datos por data.json, firmas por images/*.
// Marca por tenant.

#let data = json("data.json")
#let brand = data.brand
#let p = data.permit

#let navy = rgb(brand.dark)
#let primary = rgb(brand.primary)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: p.titulo)
#set text(font: ("Liberation Sans", "DejaVu Sans"), size: 9.5pt, fill: rgb("#2D2D2D"))
#set par(justify: false, leading: 0.6em)

#set page(
  paper: "a4",
  margin: (x: 1.6cm, top: 3.2cm, bottom: 2.4cm),
  header: context {
    set text(size: 8.5pt, fill: muted)
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      [#if brand.logo != "" [#box(image(brand.logo, height: 1cm))] else [#text(weight: "bold", size: 12pt, fill: navy)[#brand.name]]],
      [
        #text(weight: "bold", fill: navy, size: 9pt)[PERMISO DE TRABAJO] \
        #brand.legal_name — ISO 9001:2015 · ISO 14001:2015
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
          let parts = ()
          if brand.website != "" { parts.push(brand.website) }
          if brand.email != "" { parts.push(brand.email) }
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

// ── Título + estado ──
#align(center)[#text(size: 15pt, weight: "bold", fill: navy)[#p.titulo]]
#v(3pt)
#align(center)[
  #box(
    fill: if p.estado == "aprobado" { rgb("#DCFCE7") } else { rgb("#FEF3C7") },
    inset: (x: 8pt, y: 3pt),
    radius: 10pt,
  )[#text(size: 9pt, weight: "bold", fill: if p.estado == "aprobado" { rgb("#15803D") } else { rgb("#B45309") })[#upper(p.estado)]]
]
#v(10pt)

// ── 1. Datos básicos ──
#sec[1. Datos básicos del permiso]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Empresa], [#p.empresa],
    label[Ciudad / Lugar], [#p.ciudad_lugar],
    label[Código del proyecto], [#p.area_proceso],
    label[Ubicación], [#p.ubicacion],
    ..(if p.es_altura {
      (label[Fecha inicio], [#p.fecha_inicio], label[Fecha fin], [#p.fecha_fin])
    } else {
      (label[Fecha], [#p.fecha])
    }),
    label[Hora], [#p.hora_inicio — #p.hora_fin],
    ..(if p.es_altura {
      (label[Altura estimada], [#p.altura_estimada])
    } else {
      (label[Equipo a usar], [#p.equipo_a_usar])
    }),
    label[Descripción], [#p.descripcion_tarea],
  )
]
#v(10pt)

// ── 2. Personal autorizado ──
#sec[2. Personal autorizado]
#v(5pt)
#table(
  columns: (auto, 1fr, auto, 3cm),
  stroke: 0.5pt + hair,
  inset: 5pt,
  align: (center + horizon, left + horizon, left + horizon, center + horizon),
  table.header(
    table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[\#]],
    table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[Nombre]],
    table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[Cédula]],
    table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[Firma]],
  ),
  ..data.personal.enumerate().map(((i, per)) => (
    [#(i + 1)],
    [#per.nombre],
    [#if per.cedula != "" [#per.cedula] else [—]],
    if per.firma != "" [#image(per.firma, height: 1cm)] else [—],
  )).flatten(),
)
#v(10pt)

// ── 3. Checklist ──
#sec[3. Lista de verificación de seguridad]
#v(5pt)
#for grp in data.checklist [
  #block(fill: panel, inset: (x: 8pt, y: 4pt), radius: 3pt, width: 100%)[#text(weight: "bold", size: 9pt)[#grp.seccion]]
  #v(2pt)
  #for it in grp.items [
    #grid(
      columns: (1fr, 2.2cm),
      align: (left + horizon, center + horizon),
      inset: (y: 2pt),
      [#text(size: 8.5pt)[#it.texto]],
      [#text(size: 8pt, weight: "bold", fill: if it.cumple == true { rgb("#15803D") } else if it.cumple == false { rgb("#DC2626") } else { muted })[#if it.cumple == true [✓ Cumple] else if it.cumple == false [✗ No Cumple] else [— N/A]]],
    )
    #line(length: 100%, stroke: 0.3pt + hair)
  ]
  #v(4pt)
]

// ── 4. Autorización ──
#sec[4. Autorización y cierre]
#v(4pt)
#text(size: 8pt, fill: muted)[Este permiso tiene vigencia exclusiva para el turno y la tarea especificada.]
#v(8pt)
#grid(
  columns: (1fr, 1fr),
  gutter: 22pt,
  ..((("EMISOR", data.emisor), ("VIGÍA SST", data.vigia)).map(((titulo, s)) => [
    #if s.firma != "" [#image(s.firma, height: 1.6cm)] else [#v(1.6cm)]
    #line(length: 100%, stroke: 0.5pt + rgb("#2D2D2D"))
    #v(2pt)
    #text(weight: "bold", size: 9pt)[#titulo]#if s.nombre != "" [ — #s.nombre]
    #if s.cedula != "" [ \ #text(size: 8pt, fill: muted)[CI: #s.cedula]]
  ])),
)
#if p.observaciones != "" [
  #v(10pt)
  #label[Observaciones]
  #v(2pt)
  #text(size: 9pt)[#p.observaciones]
]
