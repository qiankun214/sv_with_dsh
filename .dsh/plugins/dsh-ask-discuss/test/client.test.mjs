import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { en, NS, zh } from '../src/client/locales.js'
import { insertStyles, STYLE_ID } from '../src/client/styles.js'
import { API_PREFIX, createTransport } from '../src/client/transport.js'

/**
 * A fetch stand-in answering one canned response.
 * @param response - the response to answer with.
 * @returns the fake plus its call log.
 */
function fakeFetch(response) {
	const calls = []
	const impl = async (url, init) => {
		calls.push({ url, init })
		if (response instanceof Error) throw response
		return response
	}
	return { impl, calls }
}

/**
 * A JSON response stand-in.
 * @param payload - the decoded body.
 * @param ok - the HTTP success flag.
 * @param status - the HTTP status.
 * @returns the response stand-in.
 */
function jsonResponse(payload, ok = true, status = 200) {
	return { ok, status, json: async () => payload }
}

describe('createTransport', () => {
	it('posts the session and token to the open route', async () => {
		const fake = fakeFetch(jsonResponse({ ok: true, token: 2 }))
		const transport = createTransport({ fetchImpl: fake.impl })
		const payload = await transport.open({ sessionId: 's1', token: 1 })
		assert.deepEqual(payload, { ok: true, token: 2 })
		assert.equal(fake.calls[0].url, `${API_PREFIX}/open`)
		assert.equal(fake.calls[0].init.method, 'POST')
		assert.deepEqual(JSON.parse(fake.calls[0].init.body), { sessionId: 's1', token: 1 })
	})

	it('encodes the session id and token in the transcript query', async () => {
		const fake = fakeFetch(jsonResponse({ ok: true, messages: [] }))
		const transport = createTransport({ fetchImpl: fake.impl })
		await transport.transcript({ sessionId: 'a b', token: 7 })
		assert.equal(fake.calls[0].url, `${API_PREFIX}/transcript?sessionId=a%20b&token=7`)
		await transport.transcript({ sessionId: 's1' })
		assert.equal(fake.calls[1].url, `${API_PREFIX}/transcript?sessionId=s1`)
	})

	it('folds a non-success status into an unreachable refusal', async () => {
		const transport = createTransport({ fetchImpl: fakeFetch(jsonResponse({}, false, 404)).impl })
		const payload = await transport.open({ sessionId: 's1' })
		assert.equal(payload.ok, false)
		assert.equal(payload.reason, 'unreachable')
		assert.match(payload.message, /404/)
	})

	it('folds a thrown request into an unreachable refusal', async () => {
		const transport = createTransport({ fetchImpl: fakeFetch(new Error('no route')).impl })
		const payload = await transport.send({ sessionId: 's1', token: 1, text: 'hi' })
		assert.equal(payload.ok, false)
		assert.equal(payload.reason, 'unreachable')
	})

	it('rejects a payload that is not an object', async () => {
		const transport = createTransport({ fetchImpl: fakeFetch(jsonResponse(null)).impl })
		const payload = await transport.state('s1')
		assert.equal(payload.ok, false)
		assert.equal(payload.reason, 'internal')
	})
})

describe('dictionaries', () => {
	it('namespaces itself', () => {
		assert.equal(NS, 'askDiscuss')
	})

	it('keeps zh and en key sets identical', () => {
		assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
	})

	it('has a sentence for every refusal reason the Host can produce', () => {
		const reasons = [
			'no-pending',
			'plan-review',
			'parent-unavailable',
			'stale',
			'empty-text',
			'text-too-long',
			'unreachable',
			'create-failed',
			'send-failed',
			'internal',
			'unknown',
		]
		for (const reason of reasons) assert.equal(typeof zh[`reason.${reason}`], 'string', reason)
	})
})

describe('insertStyles', () => {
	/** A minimal document stand-in that records the injected tag. */
	function fakeDocument() {
		const head = { children: [] }
		head.appendChild = (tag) => head.children.push(tag)
		const doc = {
			head,
			getElementById: (id) => head.children.find((tag) => tag.id === id) ?? null,
			createElement: () => {
				const tag = { dataset: {}, textContent: '', id: '', remove: () => head.children.splice(head.children.indexOf(tag), 1) }
				return tag
			},
		}
		return doc
	}

	it('injects one tag and removes it on dispose', () => {
		const doc = fakeDocument()
		const dispose = insertStyles(doc)
		assert.equal(doc.head.children.length, 1)
		assert.equal(doc.head.children[0].id, STYLE_ID)
		assert.equal(doc.head.children[0].dataset.plugin, 'dsh-ask-discuss')
		dispose()
		assert.equal(doc.head.children.length, 0)
	})

	it('is idempotent while the tag is present', () => {
		const doc = fakeDocument()
		insertStyles(doc)
		const second = insertStyles(doc)
		assert.equal(doc.head.children.length, 1)
		second()
	})
})
