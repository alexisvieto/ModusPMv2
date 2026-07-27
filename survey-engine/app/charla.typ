// Nexus HSE — Acta de Charla de Seguridad (Typst). Datos por data.json, firmas por images/*.
// Marca por tenant.

#let data = json("data.json")
#let brand = data.brand
#let c = data.charla

#let navy = rgb(brand.dark)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: "Acta de Charla — " + c.titulo)
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
        #text(weight: "bold", fill: navy, size: 9pt)[CHARLA DE SEGURIDAD] \
        #brand.legal_name — ISO 45001:2018
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

// ── Título ──
#align(center)[#text(size: 15pt, weight: "bold", fill: navy)[Acta de Charla de Seguridad]]
#v(2pt)
#align(center)[#text(size: 11pt, weight: "bold")[#c.titulo]]
#v(10pt)

// ── 1. Datos de la charla ──
#sec[1. Datos de la charla]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Fecha], [#c.fecha],
    label[Hora], [#if c.hora_inicio != "" [#c.hora_inicio] else [—]],
    label[Duración], [#if c.duracion_min != "" [#c.duracion_min min] else [—]],
    label[Lugar], [#if c.lugar != "" [#c.lugar] else [—]],
    label[Facilitador], grid.cell(colspan: 3)[#if c.facilitador != "" [#c.facilitador] else [—]],
    ..(if c.descripcion != "" {
      (label[Tema], grid.cell(colspan: 3)[#c.descripcion])
    } else { () }),
  )
]
#v(10pt)

// ── 2. Lista de asistencia ──
#sec[2. Lista de asistencia]
#v(5pt)
#if data.asistentes.len() == 0 [
  #block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#text(fill: muted)[Sin asistentes registrados.]]
] else [
  #table(
    columns: (auto, 1fr, 1fr, 3cm),
    stroke: 0.5pt + hair,
    inset: 5pt,
    align: (center + horizon, left + horizon, left + horizon, center + horizon),
    table.header(
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[\#]],
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[Nombre]],
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[Cargo]],
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 8.5pt)[Firma]],
    ),
    ..data.asistentes.enumerate().map(((i, a)) => (
      [#(i + 1)],
      [#a.nombre],
      [#if a.cargo != "" [#a.cargo] else [—]],
      if a.firma != "" [#image(a.firma, height: 1cm)] else [—],
    )).flatten(),
  )
  #v(4pt)
  #text(size: 8pt, fill: muted)[Total de asistentes: #data.asistentes.len()]
]
