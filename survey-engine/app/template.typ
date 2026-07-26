// Reporte de Inspección de Sitio — plantilla editorial (Typst).
// Los datos entran por data.json; las imágenes por images/*. Marca por tenant.

#let data = json("data.json")
#let brand = data.brand
#let s = data.survey

#let navy = rgb(brand.dark)
#let primary = rgb(brand.primary)
#let muted = rgb("#6B7280")
#let hair = rgb("#E5E7EB")
#let panel = rgb("#F4F6FB")

#let sev-color(v) = if v == "alta" { rgb("#DC2626") } else if v == "baja" { rgb("#059669") } else { rgb("#D97706") }
#let sev-label(v) = if v == "alta" { "ALTA" } else if v == "baja" { "BAJA" } else { "MEDIA" }

#set document(
  title: "Reporte de Inspección — " + s.client,
  author: s.engineer,
)
#set text(font: ("Liberation Sans", "DejaVu Sans"), size: 10pt, fill: rgb("#2D2D2D"))
#set par(justify: false, leading: 0.62em)

#set page(
  paper: "a4",
  margin: (x: 1.8cm, top: 3.4cm, bottom: 2.6cm),
  header: context {
    set text(size: 8.5pt, fill: muted)
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      [#if brand.logo != "" [#box(image(brand.logo, height: 1.05cm))] else [#text(weight: "bold", size: 13pt, fill: navy)[#brand.name]]],
      [
        #text(weight: "bold", fill: navy, size: 9pt)[REPORTE DE INSPECCIÓN DE SITIO] \
        #brand.legal_name
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

#let section(title) = {
  v(0.55cm)
  text(size: 12pt, weight: "bold", fill: navy)[#title]
  v(3pt)
  line(length: 100%, stroke: 1pt + primary)
  v(6pt)
}

#let label(t) = text(fill: muted, size: 9pt)[#t]

// ── Título ──
#v(0.1cm)
#text(size: 21pt, weight: "bold", fill: navy)[Reporte de Inspección de Sitio]
#v(3pt)
#text(size: 12pt, fill: primary, weight: "bold")[#s.client#if s.project != "" [ — #s.project]]
#v(0.5cm)

// ── Datos de la inspección ──
#block(fill: panel, inset: 13pt, radius: 6pt, width: 100%)[
  #grid(
    columns: (auto, 1fr, auto, 1fr),
    row-gutter: 9pt,
    column-gutter: (10pt, 26pt, 10pt),
    label[Cliente], [#s.client], label[Proyecto], [#s.project],
    label[Sitio], [#s.site], label[Fecha], [#s.date],
    label[Ingeniero], [#s.engineer], label[Código Odoo], [#s.odoo_code],
    label[Estado], [#if s.status == "completado" [Completado] else [Borrador]], [], [],
  )
]

// ── Contactos ──
#if data.contacts.len() > 0 {
  section("Contactos — con quién se habló")
  table(
    columns: (1.4fr, 1fr, 1fr, 1.4fr),
    stroke: 0.5pt + hair,
    inset: 7pt,
    align: left + horizon,
    table.header(
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 9pt)[Nombre]],
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 9pt)[Cargo]],
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 9pt)[Teléfono]],
      table.cell(fill: navy)[#text(fill: white, weight: "bold", size: 9pt)[Correo]],
    ),
    ..data.contacts.map(c => ([#c.name], [#c.role], [#c.phone], [#c.email])).flatten(),
  )
}

// ── Dificultades ──
#if data.findings.len() > 0 {
  section("Dificultades y observaciones")
  for f in data.findings {
    block(width: 100%, inset: (y: 4pt), breakable: false)[
      #grid(
        columns: (auto, 1fr),
        column-gutter: 9pt,
        align: (left + top, left + top),
        box(fill: sev-color(f.severity), inset: (x: 6pt, y: 3pt), radius: 3pt)[#text(fill: white, size: 8pt, weight: "bold")[#sev-label(f.severity)]],
        [#text(weight: "bold")[#f.title]#if f.description != "" [ \ #text(fill: muted)[#f.description]]],
      )
    ]
    v(3pt)
  }
}

// ── Evidencia fotográfica ──
#if data.photos.len() > 0 {
  section("Evidencia fotográfica")
  grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 9pt,
    ..data.photos.map(p => [
      #box(radius: 4pt, clip: true, stroke: 0.5pt + hair, width: 100%)[#image(p.path, width: 100%, height: 4cm, fit: "cover")]
      #if p.caption != "" [#v(2pt) #text(size: 8pt, fill: muted)[#p.caption]]
    ]),
  )
}

// ── Notas ──
#if s.notes != "" {
  section("Notas generales")
  s.notes
}

// ── Firmas ──
#section("Firmas")
#grid(
  columns: (1fr, 1fr),
  gutter: 22pt,
  row-gutter: 18pt,
  ..data.signatures.map(sig => [
    #if sig.path != "" [#image(sig.path, height: 1.9cm)] else [#v(1.9cm)]
    #line(length: 100%, stroke: 0.5pt + rgb("#2D2D2D"))
    #v(2pt)
    #text(weight: "bold")[#sig.signer_name]#if sig.signer_role != "" [ #text(fill: muted)[— #sig.signer_role]]
    #if sig.signed_at != "" [ \ #text(size: 8pt, fill: muted)[#sig.signed_at]]
  ]),
  [
    #v(1.9cm)
    #line(length: 100%, stroke: 0.5pt + rgb("#2D2D2D"))
    #v(2pt)
    #text(weight: "bold")[#s.engineer] #text(fill: muted)[— Ingeniero responsable]
  ],
)
