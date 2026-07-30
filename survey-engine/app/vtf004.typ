// Nexus Comercial — Formato de Visita Técnica a Cliente (VT-F-004). Editorial, marca por tenant.

#let data = json("data.json")
#let brand = data.brand
#let m = data.m

#let navy = rgb(brand.dark)
#let accent = rgb(brand.primary)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#set document(title: "Visita Técnica — " + m.record_label)
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
        #text(weight: "bold", fill: navy, size: 9pt)[VISITA TÉCNICA A CLIENTE] \
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
#let obsblock(titulo, val) = [
  #label(titulo) \
  #block(fill: panel, inset: 8pt, radius: 4pt, width: 100%)[#if val != "" [#val] else [#text(fill: muted)[No aplica]]]
  #v(6pt)
]
#let pers-table(rows) = if rows.len() > 0 [
  #table(
    columns: (1.4fr, 1fr),
    stroke: 0.5pt + hair,
    inset: 6pt,
    fill: (_, r) => if r == 0 { panel } else { white },
    table.header(text(weight: "bold", size: 8.5pt)[Nombre y apellido], text(weight: "bold", size: 8.5pt)[Cargo]),
    ..rows.map(p => (dash(p.nombre), dash(p.cargo))).flatten(),
  )
] else [#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#text(fill: muted)[Sin registros]]]

// ── Título + nº ──
#align(center)[#text(size: 16pt, weight: "bold", fill: navy)[Visita Técnica a Cliente]]
#v(3pt)
#align(center)[
  #box(fill: accent.transparentize(85%), inset: (x: 10pt, y: 3pt), radius: 10pt)[
    #text(size: 9.5pt, weight: "bold", fill: accent)[#m.record_label]
  ]
]
#v(10pt)

// ── 1. Datos generales ──
#sec[1. Datos generales]
#v(5pt)
#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 6pt,
    column-gutter: 10pt,
    label[Cliente], [#dash(m.cliente)], label[Fecha], [#dash(m.fecha)],
    label[Frecuencia], grid.cell(colspan: 3)[#dash(m.frecuencia_label)],
    label[Objetivo(s)], grid.cell(colspan: 3)[#dash(m.objetivos)],
  )
]
#v(10pt)

// ── 2. Personal de Ingesoft ──
#sec[2. Personal de Ingesoft que participa]
#v(5pt)
#pers-table(data.personal_ingesoft)
#v(10pt)

// ── 3. Personal del cliente ──
#sec[3. Personal del cliente (retroalimentación)]
#v(5pt)
#pers-table(data.personal_cliente)
#v(10pt)

// ── 4. Observaciones ──
#sec[4. Observaciones]
#v(5pt)
#obsblock("Estructurales (si aplica)", m.obs_estructurales)
#obsblock("Técnicas (si aplica)", m.obs_tecnicas)
#obsblock("Condiciones generales", m.obs_condiciones)
#obsblock("Otras observaciones", m.obs_otras)

// ── 5. Temas / compromisos ──
#sec[5. Temas tratados, oportunidades de mejora o compromisos]
#v(5pt)
#if data.temas.len() > 0 [
  #table(
    columns: (2fr, 1fr, auto),
    stroke: 0.5pt + hair,
    inset: 6pt,
    fill: (_, r) => if r == 0 { panel } else { white },
    table.header(
      text(weight: "bold", size: 8.5pt)[Puntos],
      text(weight: "bold", size: 8.5pt)[Responsable],
      text(weight: "bold", size: 8.5pt)[Fecha],
    ),
    ..data.temas.map(t => (dash(t.punto), dash(t.responsable), dash(t.fecha))).flatten(),
  )
] else [#block(fill: panel, inset: 10pt, radius: 5pt, width: 100%)[#text(fill: muted)[Sin registros]]]
#v(18pt)

// ── Firma ──
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
