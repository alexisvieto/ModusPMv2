// Nexus Comercial — Minuta de Visita a Clientes (VT-F-003). Datos por data.json.
// Documento editorial, marca por tenant. El código de formato es fijo.

#let data = json("data.json")
#let brand = data.brand
#let m = data.m

#let navy = rgb(brand.dark)
#let accent = rgb(brand.primary)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: "Minuta de Visita — " + m.record_label)
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
        #text(weight: "bold", fill: navy, size: 9pt)[MINUTA DE VISITA A CLIENTES] \
        #brand.legal_name — #m.codigo (v#m.version)
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
          let parts = (m.codigo,)
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
#let dash(v) = if v != "" [#v] else [—]

// ── Título + nº de visita ──
#align(center)[#text(size: 16pt, weight: "bold", fill: navy)[Minuta de Visita a Clientes]]
#v(3pt)
#align(center)[
  #box(fill: accent.transparentize(85%), inset: (x: 10pt, y: 3pt), radius: 10pt)[
    #text(size: 9.5pt, weight: "bold", fill: accent)[#m.record_label]
  ]
]
#v(10pt)

// ── 1. Datos del cliente ──
#sec[1. Datos del cliente]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Cliente], [#dash(m.cliente)], label[Contacto], [#dash(m.contacto)],
    label[Cargo], [#dash(m.cargo)], label[Fecha de la visita], [#dash(m.fecha_visita)],
    label[Tema de la reunión], grid.cell(colspan: 3)[#dash(m.tema_reunion)],
  )
]
#v(10pt)

// ── 2. Participantes ──
#sec[2. Participantes]
#v(5pt)
#if data.participantes.len() > 0 [
  #table(
    columns: (1.4fr, 1fr, 1fr),
    stroke: 0.5pt + hair,
    inset: 6pt,
    fill: (_, row) => if row == 0 { panel } else { white },
    table.header(
      text(weight: "bold", size: 8.5pt)[Nombre y apellido],
      text(weight: "bold", size: 8.5pt)[Cargo],
      text(weight: "bold", size: 8.5pt)[Empresa],
    ),
    ..data.participantes.map(p => (dash(p.nombre), dash(p.cargo), dash(p.empresa))).flatten(),
  )
] else [#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#text(fill: muted)[Sin participantes registrados]]]
#v(10pt)

// ── 3. Temas tratados ──
#sec[3. Temas tratados]
#v(5pt)
#if data.temas.len() > 0 [
  #block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
    #for (idx, t) in data.temas.enumerate() [
      #grid(columns: (auto, 1fr), column-gutter: 8pt,
        text(fill: accent, weight: "bold")[#(idx + 1).], [#t])
      #v(3pt)
    ]
  ]
] else [#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#text(fill: muted)[Sin temas registrados]]]
#v(10pt)

// ── 4. Acuerdos y compromisos ──
#sec[4. Acuerdos y compromisos]
#v(5pt)
#if data.acuerdos.len() > 0 [
  #table(
    columns: (2fr, 1fr),
    stroke: 0.5pt + hair,
    inset: 6pt,
    fill: (_, row) => if row == 0 { panel } else { white },
    table.header(
      text(weight: "bold", size: 8.5pt)[Descripción],
      text(weight: "bold", size: 8.5pt)[Responsable],
    ),
    ..data.acuerdos.map(a => (dash(a.descripcion), dash(a.responsable))).flatten(),
  )
] else [#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#text(fill: muted)[Sin acuerdos registrados]]]
#v(10pt)

// ── 5. Cierre ──
#sec[5. Cierre]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Próxima reunión], [#dash(m.proxima_reunion)],
    ..(if m.observaciones != "" { (label[Observaciones], [#m.observaciones]) } else { () }),
  )
]
#v(18pt)

// ── Firma / elaborado por ──
#grid(
  columns: (1fr, 1fr),
  column-gutter: 24pt,
  [
    #line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
    #v(2pt)
    #label[Elaborado por] \
    #text(weight: "bold")[#dash(m.elaborado_por)]
  ],
  [
    #line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
    #v(2pt)
    #label[Fecha] \
    #text(weight: "bold")[#dash(m.elaborado_fecha)]
  ],
)
