
#let whet-documentation(it) = {
  set heading(numbering: (first, ..rest) =>
    if rest.pos().len() > 0 {
      numbering("1.", ..rest)
    })
  show heading: set text(weight: "bold", font: "Linux Biolinum")
  show heading.where(level: 1): set text(size: 2em)
  show heading.where(level: 2): set text(size: 1.3em)
  show heading.where(level: 3): set text(size: 1.2em)
  show heading.where(level: 4): set text(size: 1em)
  show figure.caption: set text(font: "Linux Biolinum")
  show raw: set text(font: "Monaspace Argon")
  show "htmx": it => link("https://htmx.org", it)
  show "Turbo": it => link("https://turbo.hotwired.dev/", it)
  it
}

#let byline(it) = {
  set text(font: "Linux Biolinum", style: "italic", size: 1.1em)
  it
}

#let jsdoc(it) = it

#let include-jsdoc(js-code, symbol) = {
  let lines = js-code.split("\n")
  let symbol-occurrences = range(lines.len()).filter(line-no => symbol in lines.at(line-no))

  // Filter occurrences with a JSDoc comment immediately above
  symbol-occurrences = symbol-occurrences.filter(line-no => 
    line-no > 0 and " */" in lines.at(line-no - 1))

  // Find starting line of comments
  let jsdoc-ranges = symbol-occurrences.map(line-no => {
    let end-line-no = line-no - 1
    let start-line-no = end-line-no
    while (
      start-line-no > 0
      and not "/**" in lines.at(start-line-no)
     ) {
      start-line-no = start-line-no - 1
    }
    (start-line-no, end-line-no)
  })

  // Extract comments
  let jsdoc-comments = jsdoc-ranges.map(range => {
    let (start-line-no, end-line-no) = range
    lines.slice(start-line-no + 1, end-line-no - 1)
      .map(line => line.slice(calc.min(line.len() - 1, 3)))
      .join("\n")
  })

  return raw(lang: "jsdoc", jsdoc-comments.at(0))
}
