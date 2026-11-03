import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'

import { MAX_USER_TEXT } from '../lib/discussion.js'
import { registerRoutes, ROUTE_PREFIX } from '../lib/http.js'

/**
 * A response that records what the route wrote.
 * @returns the response stand-in.
 */
function fakeResponse() {
	const out = { statusCode: 0, headers: {}, body: '' }
	out.setHeader = (name, value) => {
		out.headers[name.toLowerCase()] = value
	}
	out.end = (chunk) => {
		if (chunk !== undefined) out.body += chunk
	}
	return out
}

/**
 * Run one request through the registered route.
 * @param route - the registered route.
 * @param options - method, url, and optional raw body.
 * @returns the status and the parsed JSON payload.
 */
async function call(route, options) {
	const req = new PassThrough()
	req.method = options.method ?? 'GET'
	req.url = options.url
	const res = fakeResponse()
	const handled = route.handler(req, res)
	if (options.body !== undefined) req.write(options.body)
	req.end()
	await handled
	return { status: res.statusCode, headers: res.headers, json: res.body === '' ? undefined : JSON.parse(res.body) }
}

/**
 * Claim the route against a fake Carrier and a recording discussion service.
 * @returns the route and the service's call log.
 */
function harness() {
	const calls = []
	const discussions = {
		state: (sessionId) => {
			calls.push({ op: 'state', sessionId })
			return { ok: true, pending: true, token: 3 }
		},
		open: async (input) => {
			calls.push({ op: 'open', ...input })
			return { ok: true, token: 3, pack: 'pack', messages: [] }
		},
		send: async (input) => {
			calls.push({ op: 'send', ...input })
			return { ok: true, token: 3, childId: 'child' }
		},
		transcript: async (input) => {
			calls.push({ op: 'transcript', ...input })
			return { ok: true, messages: [], running: false }
		},
	}
	let route
	const carrier = {
		register: (registered) => {
			route = registered
			return () => {}
		},
	}
	registerRoutes(carrier, discussions)
	return { route, calls }
}

describe('registerRoutes', () => {
	it('claims one prefix route at the plugin path', () => {
		const { route } = harness()
		assert.equal(route.kind, 'prefix')
		assert.equal(route.path, ROUTE_PREFIX)
		assert.equal(typeof route.handler, 'function')
	})
})

describe('GET /state', () => {
	it('answers the pending flag for one session', async () => {
		const { route, calls } = harness()
		const response = await call(route, { url: `${ROUTE_PREFIX}/state?sessionId=s1` })
		assert.equal(response.status, 200)
		assert.deepEqual(response.json, { ok: true, pending: true, token: 3 })
		assert.deepEqual(calls, [{ op: 'state', sessionId: 's1' }])
	})

	it('rejects a request without a session id', async () => {
		const { route } = harness()
		const response = await call(route, { url: `${ROUTE_PREFIX}/state` })
		assert.equal(response.status, 400)
		assert.deepEqual(response.json, { ok: false, reason: 'bad-request' })
	})
})

describe('GET /transcript', () => {
	it('forwards the session and numeric token', async () => {
		const { route, calls } = harness()
		const response = await call(route, { url: `${ROUTE_PREFIX}/transcript?sessionId=s1&token=3` })
		assert.equal(response.status, 200)
		assert.deepEqual(calls, [{ op: 'transcript', sessionId: 's1', token: 3 }])
	})

	it('ignores a non-numeric token instead of failing', async () => {
		const { route, calls } = harness()
		await call(route, { url: `${ROUTE_PREFIX}/transcript?sessionId=s1&token=nope` })
		assert.deepEqual(calls, [{ op: 'transcript', sessionId: 's1', token: undefined }])
	})
})

describe('POST /open', () => {
	it('forwards the session and token', async () => {
		const { route, calls } = harness()
		const response = await call(route, {
			method: 'POST',
			url: `${ROUTE_PREFIX}/open`,
			body: JSON.stringify({ sessionId: 's1', token: 3 }),
		})
		assert.equal(response.status, 200)
		assert.deepEqual(calls, [{ op: 'open', sessionId: 's1', token: 3 }])
	})

	it('rejects a body that is not an object', async () => {
		const { route } = harness()
		const response = await call(route, { method: 'POST', url: `${ROUTE_PREFIX}/open`, body: '[]' })
		assert.equal(response.json.ok, false)
		assert.equal(response.json.reason, 'internal')
	})

	it('rejects a missing session id', async () => {
		const { route, calls } = harness()
		const response = await call(route, { method: 'POST', url: `${ROUTE_PREFIX}/open`, body: '{}' })
		assert.equal(response.status, 400)
		assert.deepEqual(calls, [])
	})
})

describe('POST /send', () => {
	it('forwards the text', async () => {
		const { route, calls } = harness()
		const response = await call(route, {
			method: 'POST',
			url: `${ROUTE_PREFIX}/send`,
			body: JSON.stringify({ sessionId: 's1', token: 3, text: '为什么？' }),
		})
		assert.deepEqual(response.json, { ok: true, token: 3, childId: 'child' })
		assert.deepEqual(calls, [{ op: 'send', sessionId: 's1', token: 3, text: '为什么？' }])
	})

	it('refuses blank and oversized text without calling the service', async () => {
		const { route, calls } = harness()
		const blank = await call(route, { method: 'POST', url: `${ROUTE_PREFIX}/send`, body: JSON.stringify({ sessionId: 's1', text: '  ' }) })
		assert.equal(blank.status, 400)
		const oversized = await call(route, {
			method: 'POST',
			url: `${ROUTE_PREFIX}/send`,
			body: JSON.stringify({ sessionId: 's1', text: 'x'.repeat(MAX_USER_TEXT + 1) }),
		})
		assert.deepEqual(oversized.json, { ok: false, reason: 'text-too-long' })
		assert.deepEqual(calls, [])
	})
})

describe('unknown paths', () => {
	it('answers 404 with a reason', async () => {
		const { route } = harness()
		const response = await call(route, { url: `${ROUTE_PREFIX}/nope` })
		assert.equal(response.status, 404)
		assert.deepEqual(response.json, { ok: false, reason: 'not-found' })
	})

	it('answers 404 for the bare prefix', async () => {
		const { route } = harness()
		const response = await call(route, { url: ROUTE_PREFIX })
		assert.equal(response.status, 404)
	})
})
