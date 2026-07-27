// Nexus HSE — Reporte de Incidente (Typst). Datos por data.json, fotos por images/*.
// Marca por tenant.

#let data = json("data.json")
#let brand = data.brand
#let i = data.inc

#let navy = rgb(brand.dark)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: "Reporte de " + i.tipo_label)
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
        #text(weight: "bold", fill: navy, size: 9pt)[REPORTE DE INCIDENTE] \
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

// ── Título + severidad ──
#align(center)[#text(size: 15pt, weight: "bold", fill: navy)[Reporte de #i.tipo_label]]
#v(3pt)
#align(center)[
  #box(fill: rgb(i.severidad_color).transparentize(88%), inset: (x: 8pt, y: 3pt), radius: 10pt)[
    #text(size: 9pt, weight: "bold", fill: rgb(i.severidad_color))[Severidad: #upper(i.severidad_label)]
  ]
]
#v(10pt)

// ── 1. Datos del evento ──
#sec[1. Datos del evento]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Tipo], [#i.tipo_label], label[Estado], [#i.estado_label],
    label[Fecha], [#i.fecha], label[Hora], [#if i.hora != "" [#i.hora] else [—]],
    label[Ubicación], grid.cell(colspan: 3)[#if i.ubicacion != "" [#i.ubicacion] else [—]],
  )
]
#v(10pt)

// ── 2. Persona afectada ──
#sec[2. Persona afectada]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Nombre], [#if i.afectado_nombre != "" [#i.afectado_nombre] else [— Ninguno / externo —]],
    label[Días perdidos], [#i.dias_perdidos],
    label[Atención médica], grid.cell(colspan: 3)[#if i.atencion_medica [Sí] else [No]],
  )
]
#v(10pt)

// ── 3. Descripción ──
#sec[3. Descripción del evento]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#if i.descripcion != "" [#i.descripcion] else [—]]
#v(10pt)

// ── 4. Causa raíz ──
#sec[4. Causa raíz]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#if i.causa_raiz != "" [#i.causa_raiz] else [#text(fill: muted)[Pendiente de análisis]]]
#v(10pt)

// ── 5. Acción correctiva ──
#sec[5. Acción correctiva]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#if i.accion_correctiva != "" [#i.accion_correctiva] else [#text(fill: muted)[Pendiente de definir]]]

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
