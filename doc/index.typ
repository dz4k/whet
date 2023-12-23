#import "_definitions.typ": *
#show: whet-documentation

= whet

A minimal htmx clone that stays close to minimal HTML.

Hypermedia libraries (see also htmx, Turbo and more) extend HTML with more hypermedia controls.

== Install and use

Install Whet into your page as follows:

```html
<script type="module">
  import install from "whet.js"
  install()
</script>
```

To use Whet's features on an element, it should have the attribute `whet` or `data-whet`.

== Hypermedia features

Whet extends the existing hypermedia controls of HTML to remove expressive gaps.

=== Partial replacement or transclusion

The most significant gap is that barring some limited exceptions, all interactions in HTML require a page navigation. Whet lifts this limitation by allowing HTML to be inserted into the document instead of replacing it.

==== Swap target <swap-target>

The existing `target` attribute is extended to accept a CSS selector. `data-target` can also be used if the given element cannot accept the `target` attribute in valid HTML, or if there is a risk of conflict with the default behavior of `target`.

#figure(
  ```html
  <a whet href="/results" data-target="#results">Test results</a>
  <div role="region" aria-labelledby="results-title">
    <h1 id="results-title">Results</h1>
  </div>
  ```,
  caption: [Clicking the "Test results" link will get the results view from `/results`, and display it in the results div]
)

==== Swap style <swap-style>

By default, the response content replaces the inner content of the target element. This can be customized with the `swap` (or `data-swap`) attribute:

/ `swap="replaceChildren"` :
  The response content replaces all children of the element. (Default.)
/ `swap="replaceWith"` :
  The response content replaces the element itself.
/ `swap="prepend"` :
  The response content is inserted at the start of the element.
/ `swap="append"` :
  The response content is inserted at the end of the element.
/ `swap="before"` :
  The response content is inserted before the element.
/ `swap="after"` :
  The response content is inserted after the element.

It can be seen that all of these _swap styles_ share their name with methods on the DOM `Element` class. Indeed, Whet uses the method of the same name for each swap style.

=== Action parameters

This process of request, response, and content insertion that occurs when a Whet-powered element is interacted with is called an _hyperaction_. A hyperaction has many attributes that can all be customized via attributes.

==== Href
The _href_ is the URL to which a request is sent.
It can be customized via all of these attributes (listed in descending order of precedence):

- `data-action`
- `formaction`
- `action`
- `data-href`
- `formhref`
- `href`
- `data-src`
- `formsrc`
- `src`

`formhref` and `formsrc` do not necessarily make sense and are only supported because it's easier for Whet development. Their usage is not recommended.

==== Content type or enctype

For requests with a body, this is the format in which the body will be encoded, and the `Content-Type` of the request. Whet supports enctype values of:

- `text/x-www-form-urlencoded`
- `multipart/form-data`
- `application/json`

The enctype can be specified with the attributes
- `data-enctype`
- `formenctype`
- `enctype`

If none are specified, the default enctype is `text/x-www-form-urlencoded`.

==== Method

The HTTP method of the request can be specified with the attributes
- `data-method`
- `formmethod`
- `method`

=== Extracting fragments

If a hash fragment is specified on the href of an action, the element with that ID will be extracted from the response content and used as the content. This feature can be used if the application server does not provide separate resources for partial HTML and only returns complete pages. This makes it a good migration tool.

```html
<button
  data-whet
  data-target="#results"
  data-href="/results#result-section"
>Show results</a>
```

Apart from IDs, the full power of CSS selectors is available by prefixing the fragment with `:~:selector=`.

```html
<button
  data-whet
  data-target="#results"
  data-href="/results#:~:selector=.results ul"
>Show results</a>
```

=== Elsewhere swaps

The server response can, alongside the content to swap, can include extra bits of content to be swapped elsewhere in the page with `<template>` elements.

Any `<template>` element in the response with the `whet` (or `data-whet`) attribute will be subject to an elsewhere swap. The destination can be specified with #link(<swap-target>, `target`) and #link(<swap-style>, `swap`) attributes placed on the `<template>` element.

```http
HTTP/1.1 200 OK
Content-Type: text/html

<ul class="results-list">
  <!-- ...results... --->
</ul>

<template data-whet data-target=".results-count">
  <data class="resultCount">13</data> results
</template>
```

== Extended event handlers

TODO

== Programmatic API

=== Hypermedia lifecycle events

=== `whet:will-install`
=== `whet:init`
=== `whet:actuated`
=== `whet:will-fetch`
=== `whet:did-fetch-headers`
=== `whet:did-fetch`
=== `whet:fetch-error`
=== `whet:will-swap`
=== `whet:will-be-swapped`
=== `whet:did-swap`
=== `whet:was-swapped-away`

=== Action context

```
/**
 * @typedef {object} ActionContext
 * @prop {Event?} event The actuating event.
 * @prop {Element} element The actuated element.
 * @prop {Element?} target See {@linkcode getTarget}.
 * @prop {FormData} data All form data associated with this element.
 * @prop {string} method The HTTP method to be used.
 * @prop {URL} action The URL to be used.
 * @prop {Enctype} enctype The MIME type to be used for a request body.
 * @prop {Response} [response] The response, if the request has been sent.
 * @prop {string} [responseText] The response body, if fetched.
 */
```

=== Helpers

TODO

==== `$`

#jsdoc(```
/**
 * querySelector alias.
 * @param {string} selector CSS selector
 * @param {ParentNode} [root=document] the element to query within, the `:scope`
 * @returns {Element | null} the first matching element
 */
```)
