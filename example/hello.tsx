#!/usr/bin/env -S deno run --allow-net --allow-read
/** @jsx jsx */
import { Hono } from 'https://deno.land/x/hono@v3.4.1/mod.ts'
import { jsx, serveStatic } from 'https://deno.land/x/hono@v3.4.1/middleware.ts'

const app = new Hono()

app.use('/lib/*', serveStatic({ root: './' }))

app.get('/', (c) =>
	c.html(
		'<!doctype html>' + (
			<html>
				<head>
					<title>whet example</title>
					<script type='module' src='/lib/whet.js'></script>
				</head>
				<body>
					<h1>whet example</h1>
					<p>Replace the button</p>
					<button whet data-href='/success' data-target=':this'>
						Replace me
					</button>
					<p>Add more buttons</p>
					<template
						whet
						data-event='whet:init'
						data-href='/add-more'
						data-target=':this'
						data-swap='replaceWith'
					>
					</template>
				</body>
			</html>
		),
	))

app.get('/success', (c) => c.html('Replaced!'))
app.get('/add-more', (c) =>
	c.html(
		<button
			whet
			data-href='/add-more'
			data-target=':this'
			data-swap='after'
		>
			Add another
		</button>,
	))

Deno.serve(app.fetch)
