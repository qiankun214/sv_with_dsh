import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createDiscussionService, DISCUSSION_PROVIDER, DISCUSSION_TOOLS, MAX_USER_TEXT } from '../lib/discussion.js'
import { PACK_SEPARATOR } from '../lib/pack.js'

const SESSION = 'session-1'
const CHILD = 'session-child'

/** One ordinary question, as the ask tool would send it. */
const QUESTIONS = [
	{
		id: 'q1',
		header: '存储格式',
		question: '草稿用哪种格式存？',
		options: [{ label: '存 Host' }, { label: '只留内存' }],
	},
]

/** The one live Agent instance of the asking Session; identity is what the service authenticates. */
const AGENT = { id: SESSION }

/** A request as the waterfall delivers it, with its asking Agent. */
function request(agent = AGENT) {
	return { agent, questions: QUESTIONS }
}

/**
 * Build the dependency bag the service consumes, recording every call.
 * @param overrides - per-dependency replacements.
 * @returns the service plus its call log.
 */
function harness(overrides = {}) {
	const calls = { started: [], sent: [], interrupted: [] }
	const state = { surfaces: new Map(), agents: new Map([[SESSION, AGENT]]) }
	const deps = {
		agents: { get: (id) => state.agents.get(id) },
		subagents: {
			startContinuable: async (spec) => {
				calls.started.push(spec)
				return { childId: CHILD, messageId: 'message-1' }
			},
			sendMessage: async (parent, targetId, content) => {
				calls.sent.push({ parent, targetId, content })
				return 'message-2'
			},
			interrupt: (childId, authority) => {
				calls.interrupted.push({ childId, authority })
			},
		},
		sessionQuery: { readSurface: async (id) => ({ events: state.surfaces.get(id) ?? [] }) },
		logger: { warn() {} },
		...overrides,
	}
	return { service: createDiscussionService(deps), calls, state }
}

describe('pending bookkeeping', () => {
	it('records an agent-scoped request and reports it pending', () => {
		const { service } = harness()
		const record = service.begin(request())
		assert.equal(record.sessionId, SESSION)
		assert.deepEqual(service.state(SESSION), { ok: true, pending: true, token: record.token })
	})

	it('ignores an agentless request', () => {
		const { service } = harness()
		assert.equal(service.begin({ questions: QUESTIONS }), undefined)
		assert.equal(service.state(SESSION).pending, false)
	})

	it('ignores a request with no questions', () => {
		const { service } = harness()
		assert.equal(service.begin({ agent: { id: SESSION }, questions: [] }), undefined)
	})

	it('reports not-pending for a plan review, which stays on the native card', () => {
		const { service } = harness()
		service.begin({
			agent: { id: SESSION },
			questions: [{ id: 'p', question: 'Approve?', detail: '# plan', intent: { kind: 'plan-review', approve: 'Approve' }, options: [{ label: 'Approve' }] }],
		})
		assert.equal(service.state(SESSION).pending, false)
	})

	it('retires the previous request when a new one arrives', () => {
		const { service, calls } = harness()
		const first = service.begin(request())
		const second = service.begin(request())
		assert.notEqual(first.token, second.token)
		assert.equal(calls.interrupted.length, 0, 'a request with no discussion is not "interrupted"')
		assert.equal(service.state(SESSION).token, second.token)
	})
})

describe('open', () => {
	it('hands back the pack before any discussion exists', async () => {
		const { service } = harness()
		service.begin(request())
		const opened = await service.open({ sessionId: SESSION })
		assert.equal(opened.ok, true)
		assert.match(opened.pack, /草稿用哪种格式存？/)
		assert.deepEqual(opened.messages, [])
		assert.equal(opened.childId, undefined)
		assert.equal(opened.running, false)
	})

	it('builds the pack from the asking session surface', async () => {
		const { service, state } = harness()
		state.surfaces.set(SESSION, [{ type: 'user/message', seq: 1, data: { content: [{ type: 'text', text: '先看 requirements' }] } }])
		service.begin(request())
		const opened = await service.open({ sessionId: SESSION })
		assert.match(opened.pack, /\[用户\] 先看 requirements/)
	})

	it('refuses when nothing is pending, on a stale token, and on a plan review', async () => {
		const empty = harness().service
		assert.deepEqual(await empty.open({ sessionId: SESSION }), { ok: false, reason: 'no-pending' })

		const { service } = harness()
		const record = service.begin(request())
		assert.deepEqual(await service.open({ sessionId: SESSION, token: record.token + 1 }), { ok: false, reason: 'stale' })

		const plan = harness().service
		plan.begin({
			agent: { id: SESSION },
			questions: [{ id: 'p', question: 'Approve?', detail: '# plan', intent: { kind: 'plan-review', approve: 'Approve' }, options: [{ label: 'Approve' }] }],
		})
		assert.deepEqual(await plan.open({ sessionId: SESSION }), { ok: false, reason: 'plan-review-unsupported' })
	})

	it('survives a surface read failure by packing without history', async () => {
		const { service } = harness({
			sessionQuery: {
				readSurface: async () => {
					throw new Error('no backend')
				},
			},
		})
		service.begin(request())
		const opened = await service.open({ sessionId: SESSION })
		assert.equal(opened.ok, true)
		assert.match(opened.pack, /（无可用的历史对话，只按上面的问题回答。）/)
	})
})

describe('send', () => {
	it('creates the partner on first use with the pack, read-only tools, and the spawn backend', async () => {
		const { service, calls, state } = harness()
		state.surfaces.set(SESSION, [{ type: 'user/message', seq: 1, data: { content: [{ type: 'text', text: 'history line' }] } }])
		service.begin(request())
		const sent = await service.send({ sessionId: SESSION, text: '为什么选 Host？' })
		assert.deepEqual(sent, { ok: true, token: 1, childId: CHILD, running: false })
		assert.equal(calls.started.length, 1)
		const spec = calls.started[0]
		assert.equal(spec.provider, DISCUSSION_PROVIDER)
		assert.equal(spec.label, '讨论：存储格式')
		assert.equal(spec.request.parent, state.agents.get(SESSION))
		assert.deepEqual(spec.request.toolFilter, { allow: [...DISCUSSION_TOOLS] })
		assert.equal(spec.request.prompt.length, 1)
		assert.match(spec.request.prompt[0].text, /草稿用哪种格式存？/)
		assert.ok(spec.request.prompt[0].text.endsWith(`${PACK_SEPARATOR}为什么选 Host？`))
		assert.ok(spec.request.prompt[0].text.includes('[用户] history line'))
	})

	it('reuses the child for later messages', async () => {
		const { service, calls } = harness()
		service.begin(request())
		await service.send({ sessionId: SESSION, text: 'one' })
		await service.send({ sessionId: SESSION, text: 'two' })
		assert.equal(calls.started.length, 1)
		assert.equal(calls.sent.length, 1)
		assert.equal(calls.sent[0].targetId, CHILD)
		assert.deepEqual(calls.sent[0].content, [{ type: 'text', text: 'two' }])
	})

	it('uses the configured subagent model route when the setting is on', async () => {
		const { service, calls } = harness({
			subagentModelSelection: { current: () => ({ enabled: true, allowedModels: [{ provider: 'deepseek', model: 'cheap' }] }) },
		})
		service.begin(request())
		await service.send({ sessionId: SESSION, text: 'hi' })
		assert.deepEqual(calls.started[0].request.agentOptions, { provider: 'deepseek', model: 'cheap' })
	})

	it('inherits the parent route when the setting is off', async () => {
		const { service, calls } = harness({
			subagentModelSelection: { current: () => ({ enabled: false, allowedModels: [{ provider: 'deepseek', model: 'cheap' }] }) },
		})
		service.begin(request())
		await service.send({ sessionId: SESSION, text: 'hi' })
		assert.equal(calls.started[0].request.agentOptions, undefined)
	})

	it('refuses empty text, oversized text, and a missing parent', async () => {
		const { service, state } = harness()
		service.begin(request())
		assert.deepEqual(await service.send({ sessionId: SESSION, text: '   ' }), { ok: false, reason: 'empty-text' })
		assert.deepEqual(await service.send({ sessionId: SESSION, text: 'x'.repeat(MAX_USER_TEXT + 1) }), { ok: false, reason: 'text-too-long' })
		state.agents.delete(SESSION)
		assert.deepEqual(await service.send({ sessionId: SESSION, text: 'hi' }), { ok: false, reason: 'parent-unavailable' })
	})

	it('reports a failed creation with its reason', async () => {
		const { service } = harness({
			subagents: {
				startContinuable: async () => {
					throw new Error('spawn backend is draining')
				},
				sendMessage: async () => 'unused',
				interrupt: () => {},
			},
		})
		service.begin(request())
		const sent = await service.send({ sessionId: SESSION, text: 'hi' })
		assert.deepEqual(sent, { ok: false, reason: 'create-failed', message: 'spawn backend is draining' })
	})

	it('reports a failed delivery', async () => {
		const { service } = harness({
			subagents: {
				startContinuable: async () => ({ childId: CHILD, messageId: 'm' }),
				sendMessage: async () => {
					throw new Error('not admitted')
				},
				interrupt: () => {},
			},
		})
		service.begin(request())
		await service.send({ sessionId: SESSION, text: 'one' })
		assert.deepEqual(await service.send({ sessionId: SESSION, text: 'two' }), {
			ok: false,
			reason: 'send-failed',
			message: 'not admitted',
		})
	})
})

describe('transcript', () => {
	it('strips the pack from the partner log', async () => {
		const { service, state } = harness()
		service.begin(request())
		await service.send({ sessionId: SESSION, text: '为什么？' })
		const pack = (await service.open({ sessionId: SESSION })).pack
		state.surfaces.set(CHILD, [
			{ type: 'user/message', seq: 1, data: { content: [{ type: 'text', text: `${pack}${PACK_SEPARATOR}为什么？` }] } },
			{ type: 'assistant/message', seq: 2, data: { message: { content: [{ type: 'text', text: '因为刷新后要能回来。' }] } } },
		])
		const transcript = await service.transcript({ sessionId: SESSION })
		assert.equal(transcript.ok, true)
		assert.deepEqual(
			transcript.messages.map((message) => [message.role, message.text]),
			[
				['user', '为什么？'],
				['assistant', '因为刷新后要能回来。'],
			],
		)
	})

	it('is empty before the partner exists', async () => {
		const { service } = harness()
		service.begin(request())
		assert.deepEqual(await service.transcript({ sessionId: SESSION }), { ok: true, token: 1, childId: undefined, messages: [], running: false })
	})
})

describe('lifecycle', () => {
	it('interrupts the discussion when the human answers', async () => {
		const { service, calls } = harness()
		const record = service.begin(request())
		await service.send({ sessionId: SESSION, text: 'hi' })
		service.end(record)
		assert.deepEqual(calls.interrupted, [{ childId: CHILD, authority: { kind: 'user', parentSessionId: SESSION } }])
		assert.equal(service.state(SESSION).pending, false)
	})

	it('reports running from agent status events for its own child only', async () => {
		const { service } = harness()
		service.begin(request())
		await service.send({ sessionId: SESSION, text: 'hi' })
		service.observeStatus('unrelated', 'running')
		assert.equal((await service.transcript({ sessionId: SESSION })).running, false)
		service.observeStatus(CHILD, 'running')
		assert.equal((await service.transcript({ sessionId: SESSION })).running, true)
		service.observeStatus(CHILD, 'idle')
		assert.equal((await service.transcript({ sessionId: SESSION })).running, false)
	})

	it('interrupts everything on dispose', async () => {
		const { service, calls } = harness()
		service.begin(request())
		await service.send({ sessionId: SESSION, text: 'hi' })
		service.dispose()
		assert.equal(calls.interrupted.length, 1)
		assert.equal(service.state(SESSION).pending, false)
	})
})
