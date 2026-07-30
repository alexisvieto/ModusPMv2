// Nexus Comercial — Encuesta de satisfacción del cliente (VT-F-002).
// Genérica: recibe secciones ya resueltas (pregunta + respuesta). Marca por tenant.

#let data = json("data.json")
#let brand = data.brand
#let e = data.e

#let navy = rgb(brand.dark)
#let accent = rgb(brand.primary)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: "Encuesta de satisfacción — " + e.record_label)
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
        #text(weight: "bold", fill: navy, size: 9pt)[ENCUESTA DE SATISFACCIÓN] \
        #brand.legal_name — #e.codigo (v#e.version)
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
          let parts = (e.codigo,)
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

// ── Título + tipo ──
#align(center)[#text(size: 16pt, weight: "bold", fill: navy)[Encuesta de Satisfacción del Cliente]]
#v(3pt)
#align(center)[
  #box(fill: accent.transparentize(85%), inset: (x: 10pt, y: 3pt), radius: 10pt)[
    #text(size: 9.5pt, weight: "bold", fill: accent)[#e.record_label · #e.tipo_label]
  ]
]
#v(10pt)

// ── Contexto ──
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Cliente], [#dash(e.cliente)], label[#e.ref_label], [#dash(e.referencia)],
    label[Fecha de respuesta], grid.cell(colspan: 3)[#dash(e.answered_fecha)],
  )
]
#v(10pt)

// ── Secciones (pregunta + respuesta) ──
#for s in data.secciones [
  #sec[#s.titulo]
  #v(5pt)
  #block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
    #for (idx, it) in s.items.enumerate() [
      #grid(columns: (1fr, auto), column-gutter: 12pt,
        text(size: 9pt)[#it.pregunta],
        text(weight: "bold", fill: navy)[#it.respuesta])
      #if idx < s.items.len() - 1 [#v(3pt) #line(length: 100%, stroke: 0.4pt + hair) #v(3pt)]
    ]
  ]
  #v(10pt)
]

// ── Comentarios ──
#if e.comentarios != "" [
  #sec[Comentarios adicionales]
  #v(5pt)
  #block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#e.comentarios]
]
