<h1><div role="img" aria-label="whet">
<pre aria-hidden="true">
      #       #
#   # ### ### ##
# | # # # #-  #
##### # # ### ##
</pre></div></h1>

**whet** is a tiny [htmx] clone with a focus on staying close to vanilla HTML.

Instead of:

```html
<button hx-get="/resource">Do the thing</button>
```

you would write:

```html
<a whet href="/resource">Do the thing</a> <!-- or -->
<button whet data-href="/resource">Do the thing</button>
```

Instead of hx- attributes, we only have one custom attribute (`whet` or
`data-whet`) and the rest are standard HTML attributes (with `data-` prefixes
optional for where those attributes are not normally allowed, as well as `form`
prefix since that's a thing).

I believe this will make the library easier to learn, and less likely to produce
invalid HTML (e.g. `<a>` without `href`).

## Absent htmx features

- history
- websockets
- server sent events
- hx-disable
- attribute inheritance
- request synchronization
- form validation
- preserve
- extensions
- prompt (can be solved with events)

[htmx]: <https://htmx.org>
