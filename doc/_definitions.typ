
#let jsdoc(it) = it

#let whet-documentation(it) = {
  show heading: set text(weight: "bold")
  show heading.where(level: 1): set text(size: 2em, font: "Monaspace Krypton")
  show heading.where(level: 2): set text(size: 1.3em)
  show heading.where(level: 3): set text(size: 1.2em)
  show heading.where(level: 4): set text(size: 1em)
  show raw: set text(font: "Monaspace Xenon")
  show "htmx": it => link("https://htmx.org", it)
  show "Turbo": it => link("https://turbo.hotwired.dev/", it)
  it
}
