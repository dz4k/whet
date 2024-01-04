#import "_definitions.typ": *
#show: whet-documentation

#let whet-src = read("../lib/whet.js")

= whet: documentation

#byline[Rev. #datetime.today().display()]

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

Whet extends the `on*` attributes in HTML to support all events.

```html
<button
  onclick="alert('clicked')"
  on:whet:will-swap="e.detail.responseText.replace('foo', 'bar')"
  on-otherlibrary-event="alert('other library event')">
```

As can be seen above, an optional comma or dash can be inserted between `on` and the event name.

For whet-specific events, there exists a shorthand syntax:

```html
<button
  on::will-swap="e.detail.responseText.replace('foo', 'bar')">
  <!-- equivalent to on:whet:will-swap -->
```

== Hypermedia lifecycle events

These events are dispatched as part of the hypermedia interaction process. The `detail` property of all events is the action context (see @action-context) of the hyperaction.

=== `whet:will-install`

Dispatched on an element when Whet is about to install its event handlers on it.

=== `whet:init`

Dispatched after Whet has installed its event handlers on an element.

=== `whet:actuated`

Dispatched on an element when it has been actuated, i.e. when it has been interacted with.

=== `whet:will-fetch`

Dispatched on an element when a request is about to be sent.

`will-fetch` is an _extendable event_, which means it supports the `waitUntil` method. This allows the event handler to delay the fetch until some asynchronous operation is complete.

#figure(
  caption: [An example of using the `waitUntil` method on `whet:will-fetch`],
  ```js
  document.addEventListener("whet:will-fetch", (event) => {
    event.waitUntil(checkRequest(e))
  })
  async function checkRequest(event) { ... }
  ```
)

`will-fetch` is not dispatched if the action is a `javascript:` URI.

=== `whet:did-fetch-headers`

Dispatched when the response headers have been received and a `Response` object is available.

=== `whet:did-fetch`

Dispatched when the response body has been fully received.

=== `whet:fetch-error`

Dispatched if and when there is an error fetching the response.

The `ActionContext` will have an additional `error` property with the error.

=== `whet:will-swap`

Dispatched on the element that has been interacted with when the response content is about to be swapped into the document.

=== `whet:will-be-swapped`

Dispatched when a swap targeting this element is about to occur.

=== `whet:did-swap`

Dispatched on the element that has been interacted with when the response content has been swapped into the document.

=== `whet:was-swapped-away`

Dispatched when a swap targeting this element has occurred.


== Programmatic API

=== `$`

#include-jsdoc(whet-src, "$")

=== `$$`

#include-jsdoc(whet-src, "$$")

=== `actuate`

#include-jsdoc(whet-src, "actuate")

=== `dispatch`

#include-jsdoc(whet-src, "dispatch")

=== `encodeData`

#include-jsdoc(whet-src, "encodeData")

=== `getData`

#include-jsdoc(whet-src, "getData")

=== `install`

#include-jsdoc(whet-src, "install")

=== `parseHtml`

#include-jsdoc(whet-src, "parseHtml")

=== `swap`

#include-jsdoc(whet-src, "swap")

=== Action context <action-context>

#include-jsdoc(whet-src, "ActionContext")

where `Enctype` is a string representing a supported enctype.
