/*
  whet
  2023 Deniz Akşimşek <https://dz4k.com>
  SPDX-License-Identifier: MIT
*/

/// @ts-check
/// <reference lib="es2022" />
/// <reference lib="dom" />

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
 * @param {Element} el element
 * @param {string} attr attribute name
 * @returns {string | null}
 */
const attr = (el, attr) =>
	el.getAttribute('data-' + attr) ??
		el.getAttribute('form' + attr) ??
		el.getAttribute(attr)

/**
 * Dispatch a custom event
 * @param {EventTarget} el target element
 * @param {string} type event type
 * @param {unknown} detail event.detail object
 * @param {CustomEventInit} options options for CustomEvent constructor
 */
const dispatch = (el, type, detail = null, options = {}) =>
	el.dispatchEvent(
		new CustomEvent(type, {
			detail,
			...options,
		}),
	)

/**
 * A custom event that supports the .waitUntil method like fetch events
 */
const ExtendableEvent = class extends CustomEvent {
	/**
	 * @type {Promise<unknown>[]}
	 */
	promises = []

	/**
	 * @param {Promise<unknown>} p
	 */
	waitUntil(p) {
		this.promises.push(p)
	}

	waited() {
		return Promise.all(this.promises)
	}
}

/**
 * Dispatch a custom event that supports `.waitUntil()`.
 * @param {EventTarget} el target element
 * @param {string} type event type
 * @param {unknown} detail event.detail object
 * @param {CustomEventInit} options options for CustomEvent constructor
 * @returns {ExtendableEvent}
 */
const dispatchExtendable = (el, type, detail = null, options = {}) => {
	const event = new ExtendableEvent(type, {
		detail,
		...options,
	})
	el.dispatchEvent(event)
	return event
}

/**
 * get the ancestor Document or ShadowRoot of an element. if it has neither,
 * return the `document`.
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
 * Construct an URL object from an URL string.
 * Relative URLs will be resolved relative to `window.location`.
 * @param {string} href the url string
 * @returns {URL}
 */
const url = (href) => new URL(href, location.href)

// #endregion

// #region Hypermedia controls

/**
 * Get the <form> element associated with an input, button etc. element.
 * @param {Element} el element
 * @returns {HTMLFormElement | null} the form, if it exists
 */
const getAssociatedForm = (el) => {
	if (!('form' in el)) return null
	// TypeScript doesn't have a way to express "any Element with the form
	// property", so we use HTMLInputElement
	const formControl = /** @type {HTMLInputElement} */ (el)
	if (formControl.form instanceof HTMLFormElement) {
		return formControl.form
	}
	return null
}

/**
 * get the "target" of an element -- the element that will be swapped
 * upon this element's actuation
 * @param {Element} el the source element
 * @returns {Element?} the target element
 */
const getTarget = (el) => {
	const targetSelector = attr(el, 'target')
	if (targetSelector) {
		if (targetSelector === ':this') return el
		return $(targetSelector, root(el))
	}
	return document.body
}

const buttonLikeInputs = new Set(['button', 'submit', 'reset'])

/**
 * Get the default event that should actuate an element (e.g. "submit" for
 * forms)
 * @param {Element} el the element
 * @returns {string} the event type
 */
const getDefaultEvent = (el) => {
	if (el instanceof HTMLFormElement) return 'submit'
	if (el instanceof HTMLTextAreaElement) return 'change'
	if (el instanceof HTMLSelectElement) return 'change'
	if (el instanceof HTMLInputElement && !buttonLikeInputs.has(el.type)) {
		return 'change'
	}
	return 'click'
}

/**
 * Create an ActionContext, containing relevant data for an action to be
 * performed when an element is actuated.
 * @param {Element} el
 * @param {Event?} [ev]
 * @returns {ActionContext}
 *
 * @typedef {object} ActionContext
 * @prop {Event?} event The actuating event.
 * @prop {Element} element The actuated element.
 * @prop {Element?} target See {@linkcode getTarget}.
 * @prop {FormData} data All form data associated with this element.
 * @prop {string} method The HTTP method to be used.
 * @prop {URL} action The URL to be used.
 * @prop {string} enctype The MIME type to be used for a request body.
 */
const createContext = (el, ev = null) => {
	const action = url(
		attr(el, 'action') ?? attr(el, 'href') ?? attr(el, 'src') ?? '',
	)
	const method = attr(el, 'method') ?? 'GET'
	const enctype = attr(el, 'enctype') ?? 'text/x-www-form-urlencoded'

	const targetEl = getTarget(el)

	const data = getData(el)

	/** @type {ActionContext} */
	return {
		action,
		method,
		enctype,
		data,
		event: ev,
		element: el,
		target: targetEl,
	}
}

/**
 * Execute the code from a `javascript:` URI.
 * @param {ActionContext} args The variables that will be exposed to the code.
 * @returns {unknown} The value of the expression.
 */
const runJSUri = (args) =>
	new Function('args', `with(args){${args.action.pathname}}`)
		.call(args.element, args)

/**
 * Convert form data into a given enctype.
 * @param {FormData} data the form data
 * @param {Enctype} enctype the MIME type
 * @returns {URLSearchParams | FormData | string} This can be passed to the
 * `body` option of `fetch`.
 *
 * @typedef {
 * | "text/x-www-form-urlencoded"
 * | "multipart/form-data"
 * | "application/json"
 * } Enctype
 */
const encodeData = (data, enctype) => {
	switch (enctype) {
		case 'text/x-www-form-urlencoded':
			// @ts-ignore URLSearchParams can be constructed from form data
			return new URLSearchParams(data)
		case 'multipart/form-data':
			return data
		case 'application/json':
			return JSON.stringify(Object.fromEntries(data))
	}
	throw new Error('Unsupported enctype')
}

/**
 * Get the form data associated with an element, incl. its own value and
 * values from the associated form.
 * @param {Element} el
 * @returns {FormData}
 */
const getData = (el) => {
	const data = new FormData()

	if (el instanceof HTMLFormElement) {
		new FormData(el).forEach((v, k) => data.append(k, v))
	}

	const form = getAssociatedForm(el)
	if (form) {
		new FormData(form).forEach((v, k) => data.append(k, v))
	}

	if ('name' in el && 'value' in el) {
		// @ts-ignore no easy way to check for all form control types
		data.append(el.name, el.value)
	}

	return data
}

const httpMethodsWithoutBody = new Set(['GET', 'DELETE'])

/**
 * Perform an HTTP request as part of an action.
 * @param {ActionContext} context
 * @returns {Promise<string?>} The response body as text.
 */
const doFetch = async (context) => {
	const {
		method,
		action,
		enctype,
		element,
	} = context
	const event = dispatchExtendable(element, 'whet:will-fetch', context)
	await event.waited()
	if (event.defaultPrevented) return null
	const params = httpMethodsWithoutBody.has(method)
		? null
		: encodeData(getData(element), enctype)

	try {
		const res = await fetch(action, {
			method,
			body: params,
		})
		dispatch(element, 'whet:did-fetch-headers', context)
		const text = await res.text()
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
 * Perform "elsewhere" swaps.
 *
 * A response can specify additional content to be placed outside the action
 * target using a `<template>` element with the `data-whet` attribute and
 * `target` or `data-target` attribute as well as optional swap style.
 * @param {DocumentFragment} content
 * @returns {void}
 * @throws {TypeError} if element specifies a swap attribute, but it is not a
 * valid swap style
 */
const doElsewhereSwaps = (content) => {
	const templates = /** @type {HTMLTemplateElement[]} */ ($$(
		'template[whet], template[data-whet]',
		content,
	))
	for (const template of templates) {
		const swapStyle = getSwapStyle(template)
		const target = getTarget(template)
		// TODO: avoid creating this array
		const fragmentNodes = Array.from(template.content.children)
		target?.[swapStyle](template.content)
		fragmentNodes.map(install)
	}
}

/**
 * Swap the contents of the action target with content and then
 * {@linkcode doElsewhereSwaps}.
 *
 * @param {SwapStyle} style swap style
 * @param {ActionContext} context action context
 * @param {unknown} content the content to swap in
 * @returns {void}
 */
const swap = (style, context, content) => {
	if (!context.target) return
	if (content === null) return

	dispatch(context.element, 'whet:will-swap', context)
	dispatch(context.target, 'whet:will-be-swapped', context)

	if (content === null || content === undefined || content === false) return
	const fragment = content instanceof DocumentFragment
		? content
		: parseHtml(String(content))

	const selector = context.action.hash.startsWith(':~:selector=')
		? context.action.hash.slice(':~:selector='.length)
		: context.action.hash
		? '#' + context.action.hash
		: null

	let mainSwapContent = selector ? fragment.querySelector(selector) : fragment
	if (!mainSwapContent) {
		console.error('selector', selector, 'absent in content', fragment)
		mainSwapContent = fragment
	}

	// TODO: avoid creating this array
	const fragmentNodes = Array.from(fragment.children)

	context.target[style](mainSwapContent)
	fragmentNodes.map(install)
	doElsewhereSwaps(fragment)

	dispatch(context.element, 'whet:did-swap', context)
}

/**
 * "Actuate" an element, that is, perform its action.
 * @param {Element} el
 * @param {Event} ev
 */
const actuate = async (el, ev) => {
	const swapStyle = getSwapStyle(el)
	const context = createContext(el, ev)

	dispatch(el, 'actuated', context)

	const content = context.action.protocol === 'javascript'
		? runJSUri(context)
		: doFetch(context)

	swap(swapStyle, context, await content)
}

/**
 * Install event listener that {@linkcode actuate} an element.
 * @param {Element} el the element
 * @returns {void}
 */
const installHypermediaControls = (el) => {
	const event = attr(el, 'event') ?? getDefaultEvent(el)
	if (!event) return
	el.addEventListener(event, (ev) => actuate(el, ev))
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
	dispatch,
	encodeData,
	getData,
	install,
	parseHtml,
	swap,
}
