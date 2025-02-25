/*
  whet
  2023 Deniz Akşimşek <https://dz4k.com>
  SPDX-License-Identifier: MIT
*/

/// @ts-check
/// <reference lib="es2022" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// #region DOM utils

/**
 * querySelector alias.
 * @param {string} selector CSS selector
 * @param {ParentNode} [root=document] the element to query within, the `:scope`
 * @returns {Element | null} the first matching element
 */
const $ = (selector, root = document) => root.querySelector(selector)

/**
 * querySelectorAll alias.
 * @param {string} selector CSS selector
 * @param {ParentNode} [root=document] the element to query within, the `:scope`
 * @returns {Element[]} matching elements in root
 */
const $$ = (selector, root = document) =>
	Array.from(root.querySelectorAll(selector))

/**
 * Get attribute of element, trying `data-` and `form` prefixes before bare
 * name. i.e. try to get "data-target", "formtarget" and "target" in that order
 * and return the first one that's present.
 *
 * Whet brings support for many attributes (e.g. `href`, `action`) to elements
 * that don't usually have them, as well as adding new attributes (like `swap`).
 * To allow users' HTML to remain conformant, we allow all attributes to be
 * specified in a `data-` prefixed form.
 *
 * Form-associated elements support `form` prefixed versions of many form
 * attributes, which Whet does too with this function. Supporting the prefix
 * regardless of the attribute being looked up means users could use nonsensical
 * attributes like `formhref`, though this isn't a problem in practice since
 * no one would do it, and there would be no adverse consequences if they did.
 *
 * @param {Element} el element
 * @param {string} attr attribute name
 * @returns {string | null}
 */
const attr = (el, attr) =>
	el.getAttribute('data-' + attr) ??
		el.getAttribute('form' + attr) ??
		el.getAttribute(attr)

/**
 * Dispatch a custom event.
 * @param {EventTarget} el target element
 * @param {string} type event type
 * @param {unknown} detail event.detail object
 * @param {CustomEventInit} options options for CustomEvent constructor
 * @returns {boolean} if the event was canceled
 */
const dispatch = (el, type, detail = null, options = {}) =>
	el.dispatchEvent(
		new CustomEvent(type, {
			detail,
			...options,
		}),
	)

/**
 * A custom event that supports the .waitUntil method.
 *
 * The term "extendable event" is borrowed from a web API
 * (https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent).
 * The pattern that allows event handlers to perform asynchronous work.
 * Unfortunately, this interface is not available outside of service workers.
 * Even if it were, it doesn't let user-land code react to the event's extended
 * lifetime.
 *
 * Whet allows the user to intercept many parts of the hypermedia interaction
 * lifecycle using event listeners. By using extendable events, users can
 * perform asynchronous work before or during the cycle, and have Whet wait for
 * them.
 */
class ExtendableEvent extends CustomEvent {
	/**
	 * @type {Promise<unknown>[]}
	 */
	#promises = []

	/**
	 * Delay the default behavior until the given promise has resolved.
	 * @param {Promise<unknown>} p
	 */
	waitUntil = (p) => this.#promises.push(p)

	/**
	 * Resolves when all `waitUntil` functions have resolved.
	 * @returns {Promise<void>}
	 */
	waited = () => Promise.all(this.#promises).then(() => undefined)
}

/**
 * Dispatch an _extendable event_, custom event that supports `.waitUntil()`.
 * @see ExtendableEvent
 * @param {EventTarget} el target element
 * @param {string} type event type
 * @param {unknown} detail event.detail object
 * @param {CustomEventInit} options options for CustomEvent constructor
 * @returns {ExtendableEvent}
 */
const dispatchExtendable = (el, type, detail = null, options = {}) => {
	const event = new ExtendableEvent(type, { detail, ...options })
	el.dispatchEvent(event)
	return event
}

/**
 * get the ancestor Document or ShadowRoot of an element. if it has neither,
 * return the `document`.
 *
 * We can't just use `el.getRootNode()` -- if the element is part of a tree
 * that's detached from the document and any shadow root, this will return the
 * root element of that subtree, which is not what we want.
 *
 * @param {Element} el any element
 * @returns {ParentNode} document or shadow root
 */
const root = (el) => {
	const r = el.getRootNode()
	if (r instanceof ShadowRoot) return r
	else return document
}

/**
 * Parse an html string into DOM, using the `<template>` element.
 * @param {string} str HTML text
 * @returns {DocumentFragment} parsed DOM
 */
const parseHtml = (str) => {
	const template = document.createElement('template')
	template.innerHTML = str
	return template.content
}

/**
 * Construct an URL object from an URL string, resolving relative URLs relative
 * to `window.location`.
 * @param {string} href the url string
 * @returns {URL}
 */
const url = (href) => new URL(href, location.href)

// #endregion

// #region Hypermedia controls

// TODO: Fully support form-associated custom elements, somehow.
// Related functions: isFormControl, getAssociatedForm

/**
 * Return true if {@linkcode el} is a form control (input, textarea etc.)
 * @param {Element} el
 * @returns {el is Element & FormAssociated}
 *
 * @typedef {object} FormAssociated
 * @prop {HTMLFormElement | null} form
 * @prop {string} name
 * @prop {FormDataEntryValue} value
 */
const isFormControl = (el) =>
	'form' in el && (el.form === null || el.form instanceof HTMLFormElement)

/**
 * Get the <form> element associated with an input, button etc. element.
 * @param {Element} el element
 * @returns {HTMLFormElement | null} the form, if it exists
 */
const getAssociatedForm = (el) => {
	if (isFormControl(el)) return el.form
	const formattr = attr(el, 'form')
  if (!formattr) return null
	return /** @type {HTMLFormElement | null} */ ($(`form#${formattr}`, root(el)))
}
/**
 * get the "target" of an element -- the element that will be swapped
 * upon this element's actuation
 * @param {Element} el the source element
 * @returns {Element?} the target element
 */
const getTarget = (el) => {
	const targetSelector = attr(el, 'target')
	if (!targetSelector) return document.body
	if (targetSelector === ':this') return el
	return $(targetSelector, root(el))
}

/**
 * Values of the `<input>` element's `type` attribute that present as buttons.
 */
const buttonLikeInputs = new Set(['button', 'submit', 'reset'])

/**
 * Get the event that should actuate an element.
 * @param {Element} el the element
 * @returns {string} the event type
 */
const getEvent = (el) => {
  const specifiedEvent = attr(el, 'event')
  if (specifiedEvent) return specifiedEvent
	if (el instanceof HTMLFormElement) return 'submit'
	if (el instanceof HTMLTextAreaElement) return 'change'
	if (el instanceof HTMLSelectElement) return 'change'
	if (el instanceof HTMLInputElement && !buttonLikeInputs.has(el.type)) {
		return 'change'
	}
	return 'click'
}

/**
 * Get the HTTP method for an element (e.g. "GET" for links)
 * @param {Element} el the element
 * @returns {string} the HTTP method
 */
const getHttpMethod = (el) => {
	const specifiedMethod = attr(el, 'method')
	if (specifiedMethod) return specifiedMethod.toUpperCase()
	if (el instanceof HTMLAnchorElement) return 'GET'
	if (el instanceof HTMLFormElement) return 'GET'
	return 'POST'
}

/**
 * Get the URL that this element will send a request to.
 * @param {Element} el the element
 * @returns {URL} the URL
 */
const getHref = (el) => url(
		attr(el, 'action') ??
		attr(el, 'href') ??
		attr(el, 'src') ??
		'')

/**
 * Get the content type for the request this element will send.
 * @param {Element} el the element
 * @returns {string} a MIME type
 */
const getEnctype = (el) => attr(el, 'enctype') ?? 'text/x-www-form-urlencoded'

/**
 * @typedef {typeof swapStyles[number]} SwapStyle
 * Different kinds of swapping.
 */
const swapStyles = /** @type {const} */ ([
	'replaceChildren',
	'replaceWith',
	'after',
	'before',
	'prepend',
	'append',
])

/**
 * @type {Set<SwapStyle>}
 */
const swapStylesSet = new Set(swapStyles)

/**
 * Check if an object is a valid swap style
 * @param {*} str
 * @returns {SwapStyle} str, if it is a valid swap style
 * @throws {TypeError} if str is not a valid swap style.
 */
const asSwapStyle = (str) => {
	if (swapStylesSet.has(str)) return str
	else throw new TypeError(`Invalid swap style "${str}".`)
}

/**
 * Get the swap style of an element.
 * @param {Element} el
 * @returns {SwapStyle}
 * @throws {TypeError} if element specifies a swap attribute, but it is not a
 * valid swap style
 */
const getSwapStyle = (el) => asSwapStyle(attr(el, 'swap') ?? 'replaceChildren')

/**
 * @callback Encoder A function that encodes form data into a request body.
 * @param {FormData} data The form data to encode.
 * @returns {RequestBody} This can be passed to the
 * 	`body` option of `fetch`.
 */

/**
 * Encoder functions for request bodies.
 * @type {Map<string, Encoder>} Map of MIME type to encoder.
 */
const encoders = new Map()

/**
 * Add an encoding type for request bodies.
 * @param {string} enctype The MIME type
 * @param {object} options
 * @param {Encoder} options.encoder The encoder function
 * @returns
 */
const addEnctype = (enctype, { encoder }) => encoders.set(enctype, encoder)

addEnctype('text/x-www-form-urlencoded', {
	encoder: (data) =>
		new URLSearchParams(
			/** @type {[string, string][]} */ (Array.from(data.entries())),
		),
})
addEnctype('multipart/form-data', {
	encoder: (data) => data,
})
addEnctype('application/json', {
	encoder: (data) => JSON.stringify(Object.fromEntries(data)),
})

/**
 * @typedef {URLSearchParams | FormData | string} RequestBody
 */

/**
 * Encode form data into a given content type.
 * @param {Element} element the element
 * @param {FormData} data the form data
 * @param {string} enctype the MIME type
 * @returns {RequestBody} This can be passed to the
 * `body` option of `fetch`.
 */
const encodeData = (element, data, enctype) => {
	const encoder = encoders.get(enctype)
	if (!encoder) {
		console.error('Element', element, 'has unsupported enctype', enctype)
		return encodeData(element, data, 'text/x-www-form-urlencoded')
	}
	return encoder(data)
}

/**
 * Append all values in {@linkcode eggs} into {@linkcode basket}.
 * @param {FormData} basket The FormData to be appended to -- will be mutated!
 * @param {FormData} eggs Holds the values to append. Won't be mutated.
 */
const appendFormData = (basket, eggs) =>
	eggs.forEach((value, key) => basket.append(key, value))

/**
 * Get the form data associated with an element, incl. its own value and
 * values from the associated form.
 * @param {Element} el
 * @returns {FormData}
 */
const getData = (el) => {
	const rv = new FormData()

	const form = getAssociatedForm(el)
	if (form) appendFormData(rv, new FormData(form))

	if (el instanceof HTMLFormElement) appendFormData(rv, new FormData(el))

	if (isFormControl(el)) rv.append(el.name, el.value)

	return rv
}

const httpMethodsWithoutBody = new Set(['GET', 'DELETE'])

/**
 * @typedef {object} HypermediaExchange
 * @prop {Element} element The actuated element.
 * @prop {Event?} event The actuating event, see {@linkcode getEvent}.
 * @prop {Element?} target Element to swap, see {@linkcode getTarget}.
 * @prop {SwapStyle} swap The swap style, see {@linkcode getSwapStyle}.
 * @prop {FormData} data Associated form data, see {@linkcode getData}.
 * @prop {string} method The HTTP method, see {@linkcode getHttpmethod}.
 * @prop {URL} href The URL to be used, see {@linkcode getHref}.
 * @prop {string} enctype MIME type for request, see {@linkcode getEnctype}.
 * @prop {Response} [response] The response, if the request has been sent.
 * @prop {string} [responseText] The response body, if fetched.
 */

/**
 * Initialize a {@linkcode HypermediaExchange} with relevant data for an
 * exchange to be performed when {@linkcode el} is actuated with {@linkcode ev}.
 * @param {Element} el The hypermedia control.
 * @param {Event?} [ev] The triggering event.
 * @returns {HypermediaExchange}
 */
const createExchange = (el, ev = null) => /** @type {HypermediaExchange} */ ({
	href: getHref(el),
	method: getHttpMethod(el),
	enctype: getEnctype(el),
	data: getData(el),
	target: getTarget(el),
	swap: getSwapStyle(el),
	event: ev,
	element: el,
})

/**
 * Execute the code from a `javascript:` URI.
 * @param {HypermediaExchange} args The variables that will be exposed to the code.
 * @returns {unknown} The value of the expression.
 */
const runJSUri = (args) =>
	new Function('args', `with(args){${args.href.pathname}}`)
		.call(args.element, args)

/**
 *
 * @param {string} method
 * @param {URL} href
 * @param {string} enctype
 * @param {Element} element
 * @returns {{ body: RequestBody | null, url: URL }}
 */
const prepareRequestContent = (method, href, enctype, element) => {
  if (httpMethodsWithoutBody.has(method)) {
    const url = new URL(href)
    // @ts-ignore typescript still can't deal with this common pattern
    new URLSearchParams(getData(element))
      .forEach((v, k) => url.searchParams.append(k, v))
    return { body: null, url }
  } else {
    return {
      body: encodeData(element, getData(element), enctype),
      url: href,
    }
  }
}

/**
 * Perform an HTTP request as part of an action.
 * @param {HypermediaExchange} context
 * @returns {Promise<string?>} The response body as text.
 */
const doFetch = async (context) => {
	const { method, href, enctype, element } = context

	const event = dispatchExtendable(element, 'whet:will-fetch', context)
	if (await event.waited(), event.defaultPrevented) return null

  const { body, url } = prepareRequestContent(method, href, enctype, element)

  const headers = new Headers({ 'Whet': '1' })

	try {
		const res = context.response = await fetch(url, { method, body, headers })
		dispatch(element, 'whet:did-fetch-headers', context)

		const text = context.responseText = await res.text()
		dispatch(element, 'whet:did-fetch', context)

		return text

	} catch (error) {
		console.error(error)
		dispatch(element, 'whet:fetch-error', {
			...context,
			error,
		})
		return null
	}
}

/**
 * Insert content into document.
 * @param {object} options
 * @param {HypermediaExchange} options.context ActionContext to pass into events.
 * @param {Iterable<Node>} options.content The content to insert.
 * @param {Element | null} [options.target] The element to insert into.
 * 	Defaults to {@linkcode context}`.target`.
 * @param {SwapStyle} [options.style] The swap style to use.
 * 	Defaults to {@linkcode context}`.swap`.
 */
const insert = ({
  context,
  content,
  style = context.swap,
  target = context.target
}) => {
	if (!target) return

	const shouldProceed = dispatch(context.element, 'whet:will-swap', context) &&
		dispatch(target, 'whet:will-be-swapped', context)

	// Did any event listeners unset content to cancel the swap?
	if (!shouldProceed) return

	const myEggs = Array.from(content)
	target[style](...myEggs)
	for (const node of myEggs) if (node instanceof Element) install(node)

	dispatch(context.element, 'whet:did-swap', context)
	dispatch(target, 'whet:was-swapped-away', context)
}

/**
 * Perform "elsewhere" swaps.
 *
 * A response can specify additional content to be placed outside the action
 * target using a `<template>` element with the `data-whet` attribute and
 * `target` or `data-target` attribute as well as optional swap style.
 * @param {HypermediaExchange} context
 * @param {DocumentFragment} content
 * @returns {void}
 * @throws {TypeError} if element specifies a swap attribute, but it is not a
 * valid swap style
 */
const doElsewhereSwaps = (context, content) =>
	/** @type {HTMLTemplateElement[]} */ ($$(
		'template[whet], template[data-whet]',
		content,
	)).forEach((template) =>
		insert({
			style: getSwapStyle(template),
			context,
			target: getTarget(template),
			content: template.content.childNodes,
		})
	)

const selectorPrefix = '#:~:selector='

/**
 * Parse a CSS selector from a hash fragment, if present.
 * @param {string} hash The hash fragment, such as that returned from
 *  {@linkcode URL.hash}
 * @returns
 */
const parseSelectorFragment = (hash) => {
	let selector = hash
	if (hash.startsWith(selectorPrefix)) {
		selector = hash.slice(selectorPrefix.length)
	}
	if (!selector) return null
	return decodeURIComponent(selector)
}

/**
 * Swap the contents of the action target with content and then
 * {@linkcode doElsewhereSwaps}.
 *
 * @param {HypermediaExchange} context action context
 * @param {unknown} rawContent the content to swap in
 * @returns {void}
 */
const swap = (context, rawContent) => {
	if (!context.target) return
	if (rawContent === null) return

	const fragment = rawContent instanceof DocumentFragment
		? rawContent
		: parseHtml(String(rawContent))

	doElsewhereSwaps(context, fragment)

	const selector = parseSelectorFragment(context.href.hash)
	const refinedContent = selector
		? fragment.querySelectorAll(selector)
		: fragment.childNodes

	insert({ context, content: refinedContent })
}

/**
 * "Actuate" an element, that is, perform its hypermedia exchange.
 * @param {Element} el
 * @param {Event} ev
 */
const actuate = async (el, ev) => {
	const context = createExchange(el, ev)

	dispatch(el, 'actuated', context)

	const content = context.href.protocol === 'javascript'
		? await runJSUri(context)
		: await doFetch(context)

	swap(context, content)
}

/**
 * Install event listener that {@linkcode actuate} an element.
 * @param {Element} el the element
 * @returns {void}
 */
const installHypermediaControls = (el) => {
	el.addEventListener(getEvent(el), (ev) => {
		ev.preventDefault()
		actuate(el, ev)
	})
}

// #endregion

// #region Custom on-event attributes

/**
 * The "on*" attributes that are built into HTML for adding event listeners.
 */
const builtinEventAttributes = new Set(function* () {
	for (const key in HTMLElement.prototype) {
		if (key.startsWith('on')) yield key
	}
}())

/**
 * Add event listeners to an element from `on:` attributes that are not
 * {@linkcode builtinEventAttributes}, allowing listening to custom events
 * inline.
 * @param {Element} el element
 */
const installCustomEventAttributes = (el) => {
	for (
		const {
			name,
			value,
		} of /** @type {NamedNodeMap & Iterable<Attr>} */ (el.attributes)
	) {
		if (!name.startsWith('on')) return
		if (builtinEventAttributes.has(name)) return

		let event = name.slice(2)
		if (/^[-:]/.test(event)) event = event.slice(1)
		if (/^:/.test(event)) event = 'whet' + event

		const listener = new Function('event', value)
		el.addEventListener(event, (e) => listener.call(el, e))
	}
}

// #endregion

// #region Behavior installation

const installed = new WeakSet()

/**
 * Install whet behaviors onto relevant elements inside a root.
 * @param {ParentNode} root the root node
 */
const install = (root = document) => {
	const selector = '[whet], [data-whet]'
	const els = $$(selector, root)
	if (root instanceof Element && root.matches(selector)) els.push(root)
	els.forEach((el) => {
		if (installed.has(el)) return
		installed.add(el)
		dispatch(el, 'whet:will-install')
		installHypermediaControls(el)
		installCustomEventAttributes(el)
		dispatch(el, 'whet:init')
	})
}

// #endregion

export default install

export {
	$,
	$$,
	actuate,
	addEnctype,
	dispatch,
	encodeData,
	getData,
	install,
	parseHtml,
	swap,
}
