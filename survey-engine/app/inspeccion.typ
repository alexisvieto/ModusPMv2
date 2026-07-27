// Nexus HSE — Reporte de Inspección de Campo (Typst). Datos por data.json, fotos por images/*.
// Marca por tenant.

#let data = json("data.json")
#let brand = data.brand
#let s = data.ins

#let navy = rgb(brand.dark)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: "Reporte de Inspección de Campo")
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
        #text(weight: "bold", fill: navy, size: 9pt)[REPORTE DE INSPECCIÓN] \
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

// ── Título + riesgo ──
#align(center)[#text(size: 15pt, weight: "bold", fill: navy)[Reporte de Inspección de Campo]]
#v(3pt)
#align(center)[
  #box(fill: rgb(s.riesgo_color).transparentize(88%), inset: (x: 8pt, y: 3pt), radius: 10pt)[
    #text(size: 9pt, weight: "bold", fill: rgb(s.riesgo_color))[Riesgo: #upper(s.riesgo_label)]
  ]
]
#v(10pt)

// ── 1. Datos de la inspección ──
#sec[1. Datos de la inspección]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Fecha], [#s.fecha], label[Estado], [#s.estado_label],
    label[Tipo], [#if s.tipo_inspeccion != "" [#s.tipo_inspeccion] else [—]],
    label[Ubicación], [#if s.ubicacion != "" [#s.ubicacion] else [—]],
  )
]
#v(10pt)

// ── 2. Hallazgo ──
#sec[2. Hallazgo]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#if s.hallazgo != "" [#s.hallazgo] else [—]]
#v(10pt)

// ── 3. Acción requerida ──
#sec[3. Acción requerida]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#if s.accion_requerida != "" [#s.accion_requerida] else [#text(fill: muted)[Pendiente de definir]]]
#v(10pt)

// ── 4. Seguimiento ──
#sec[4. Seguimiento]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Responsable], [#if s.responsable != "" [#s.responsable] else [—]],
    label[Fecha límite], [#if s.fecha_limite != "" [#s.fecha_limite] else [—]],
  )
]

// ── Evidencia ──
#if data.fotos.len() > 0 [
  #v(10pt)
  #sec[Evidencia fotográfica]
  #v(5pt)
  #grid(
    columns: (1fr, 1fr),
    gutter: 8pt,
    ..data.fotos.map(f => box(
      width: 100%,
      clip: true,
      radius: 4pt,
      stroke: 0.5pt + hair,
    )[#image(f.path, width: 100%, height: 5cm, fit: "cover")]),
  )
]
