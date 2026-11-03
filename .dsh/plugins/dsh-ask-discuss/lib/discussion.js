/**
 * dsh-ask-discuss — the discussion service.
 *
 * One discussion belongs to one pending question of one Session. A discussion is
 * a durable continuable subagent created on the `spawn` backend, so the partner
 * starts with an empty conversation: the problem pack is the only thing it knows
 * about the main Session, and nothing it says ever reaches the main Session —
 * only the user's own answer on the original card does.
 *
 * The service is dependency-injected rather than Context-injected so the whole
 * lifecycle (create, send, transcript, interrupt) is testable with plain objects.
 */

import { messagesOf, stripLeadingPack } from './messages.js'
import { PACK_MESSAGE_LIMITS, PACK_SEPARATOR, buildPack, tailMessages } from './pack.js'

/** Subagent backend used for the discussion partner. */
export const DISCUSSION_PROVIDER = 'spawn'

/** Tools the partner may use: everything that can only look, nothing that can act. */
export const DISCUSSION_TOOLS = Object.freeze(['read', 'glob', 'grep', 'read_image', 'web_search', 'web_fetch', 'skill'])

/** Text kept per transcript message when rendering the panel. */
const TRANSCRIPT_TEXT_LIMIT = 8000
/** Text kept per transcript tool result. */
const TRANSCRIPT_RESULT_LIMIT = 300
/** Longest user message the endpoint accepts. */
export const MAX_USER_TEXT = 20000
/** Most questions one ask may carry; the tool caps this too. */
const MAX_QUESTIONS = 8

/**
 * Whether every question of one request is something this plugin refuses.
 * @param questions - the request's questions.
 * @returns true when the request is a plan review, which stays on the native card.
 */
function isPlanReview(questions) {
	return questions.some((question) => question?.intent?.kind === 'plan-review')
}

/**
 * Whether one decided request belongs to this plugin at all.
 * @param questions - the request's questions.
 * @returns true for an ordinary ask_user_question.
 */
function isDialogue(questions) {
	return Array.isArray(questions) && questions.length > 0 && !isPlanReview(questions)
}

/**
 * Build the child's label, which is what the subagent catalog shows.
 * @param questions - the pending questions.
 * @returns a short label naming the decision.
 */
function labelOf(questions) {
	const first = questions[0]
	const text = typeof first?.header === 'string' && first.header.trim() !== '' ? first.header.trim() : String(first?.question ?? '').trim()
	const short = text.length <= 24 ? text : `${text.slice(0, 24)}…`
	return `讨论：${short === '' ? '待决策问题' : short}`
}

/**
 * Create the discussion service.
 * @param deps - the host capabilities this feature consumes.
 * @returns the discussion operations plus the pending-request bookkeeping.
 */
export function createDiscussionService(deps) {
	/** sessionId → the request currently waiting for a human answer. */
	const records = new Map()
	/** childId → the last observed agent status. */
	const statuses = new Map()
	let sequence = 0

	/**
	 * The model route the delegation tools would use, when the setting is on.
	 * @returns subagent start options carrying `agentOptions`, or an empty object.
	 */
	function agentOptions() {
		const settings = deps.subagentModelSelection
		if (settings === undefined || typeof settings.current !== 'function') return {}
		let current
		try {
			current = settings.current()
		} catch {
			return {}
		}
		const route = current?.enabled === true && Array.isArray(current.allowedModels) ? current.allowedModels[0] : undefined
		if (route === undefined || typeof route.provider !== 'string' || typeof route.model !== 'string') return {}
		const options = { provider: route.provider, model: route.model }
		if (typeof route.reasoningEffort === 'string') options.reasoningEffort = route.reasoningEffort
		if (typeof route.maxTokens === 'number') options.maxTokens = route.maxTokens
		return { agentOptions: options }
	}

	/**
	 * Stop a discussion that can no longer be used.
	 * @param record - the discussion to interrupt.
	 */
	function interrupt(record) {
		const childId = record.childId
		if (childId === undefined) return
		record.childId = undefined
		statuses.delete(childId)
		try {
			deps.subagents?.interrupt(childId, { kind: 'user', parentSessionId: record.sessionId })
		} catch (error) {
			deps.logger?.warn?.(`ask-discuss: failed to interrupt discussion ${childId}: ${String(error?.message ?? error)}`)
		}
	}

	/**
	 * Read the asking session's current model surface, reduced for the pack.
	 * @param sessionId - the asking session.
	 * @returns the trailing messages, or an empty list when the read fails.
	 */
	async function recentMessages(sessionId) {
		if (typeof deps.sessionQuery?.readSurface !== 'function') return []
		try {
			const surface = await deps.sessionQuery.readSurface(sessionId)
			return tailMessages(messagesOf(surface?.events ?? [], PACK_MESSAGE_LIMITS))
		} catch (error) {
			deps.logger?.warn?.(`ask-discuss: failed to read the asking session's surface: ${String(error?.message ?? error)}`)
			return []
		}
	}

	/**
	 * The pack for one discussion, built once and cached on its record.
	 * @param record - the pending request.
	 * @returns the pack text.
	 */
	async function packFor(record) {
		if (record.pack !== undefined) return record.pack
		const messages = await recentMessages(record.sessionId)
		record.pack = buildPack({ questions: record.questions, messages })
		return record.pack
	}

	/**
	 * The child's transcript as the panel renders it.
	 * @param record - the pending request.
	 * @returns the reduced messages, oldest first.
	 */
	async function readTranscript(record) {
		const childId = record.childId
		if (childId === undefined || typeof deps.sessionQuery?.readSurface !== 'function') return []
		try {
			const surface = await deps.sessionQuery.readSurface(childId)
			const events = surface?.events ?? []
			const stripped = record.pack === undefined ? events : stripLeadingPack(events, record.pack, PACK_SEPARATOR)
			return messagesOf(stripped, { textLimit: TRANSCRIPT_TEXT_LIMIT, resultLimit: TRANSCRIPT_RESULT_LIMIT })
		} catch (error) {
			deps.logger?.warn?.(`ask-discuss: failed to read the discussion transcript: ${String(error?.message ?? error)}`)
			return []
		}
	}

	/**
	 * Resolve the record a client call addresses.
	 * @param sessionId - the asking session.
	 * @param token - the request identity the client last saw.
	 * @returns the record, or a refusal payload.
	 */
	function resolve(sessionId, token) {
		const record = records.get(sessionId)
		if (record === undefined) return { ok: false, reason: 'no-pending' }
		if (typeof token === 'number' && token !== record.token) return { ok: false, reason: 'stale' }
		if (isPlanReview(record.questions)) return { ok: false, reason: 'plan-review-unsupported' }
		return { ok: true, record }
	}

	/**
	 * Record one request that is now waiting for the human.
	 * @param request - the waterfall payload: questions plus the asking Agent.
	 * @returns the record, or undefined for an agentless or unusable request.
	 */
	function begin(request) {
		const agent = request?.agent
		if (agent === undefined || typeof agent?.id !== 'string') return undefined
		const questions = Array.isArray(request.questions) ? request.questions.slice(0, MAX_QUESTIONS) : []
		if (questions.length === 0) return undefined
		const previous = records.get(agent.id)
		if (previous !== undefined) end(previous)
		const record = {
			token: ++sequence,
			sessionId: agent.id,
			agent,
			questions,
			childId: undefined,
			pack: undefined,
			packAttached: false,
			createdAt: Date.now(),
		}
		records.set(agent.id, record)
		return record
	}

	/**
	 * Retire one request: forget it and stop a discussion that is still running.
	 * @param record - the record to retire.
	 */
	function end(record) {
		if (record === undefined) return
		if (records.get(record.sessionId) === record) records.delete(record.sessionId)
		interrupt(record)
	}

	/**
	 * Whether this Session currently waits on a discussable question.
	 * @param sessionId - the asking session.
	 * @returns the pending flag and the request identity.
	 */
	function state(sessionId) {
		const record = records.get(sessionId)
		if (record === undefined || !isDialogue(record.questions)) return { ok: true, pending: false }
		return { ok: true, pending: true, token: record.token }
	}

	/**
	 * Open (or re-open) the discussion panel's payload.
	 * @param input - the asking session and the request identity the client holds.
	 * @returns the pack, the transcript so far, and whether the child is running.
	 */
	async function open(input) {
		const resolved = resolve(input?.sessionId, input?.token)
		if (resolved.ok !== true) return resolved
		const record = resolved.record
		const pack = await packFor(record)
		const messages = await readTranscript(record)
		return {
			ok: true,
			token: record.token,
			question: record.questions[0] ?? undefined,
			pack,
			messages,
			childId: record.childId,
			running: record.childId !== undefined && statuses.get(record.childId) === 'running',
		}
	}

	/**
	 * Deliver one user message, creating the discussion partner on first use.
	 * @param input - the asking session, the request identity, and the text.
	 * @returns the accepted state, or a refusal with its reason.
	 */
	async function send(input) {
		const text = typeof input?.text === 'string' ? input.text.trim() : ''
		if (text === '') return { ok: false, reason: 'empty-text' }
		if (text.length > MAX_USER_TEXT) return { ok: false, reason: 'text-too-long' }
		const resolved = resolve(input?.sessionId, input?.token)
		if (resolved.ok !== true) return resolved
		const record = resolved.record
		const parent = deps.agents?.get?.(record.sessionId)
		if (parent === undefined || parent !== record.agent) return { ok: false, reason: 'parent-unavailable' }
		const controller = new AbortController()
		if (record.childId === undefined) {
			const pack = await packFor(record)
			const prompt = [{ type: 'text', text: `${pack}${PACK_SEPARATOR}${text}` }]
			try {
				const started = await deps.subagents.startContinuable({
					provider: DISCUSSION_PROVIDER,
					label: labelOf(record.questions),
					request: {
						parent,
						prompt,
						signal: controller.signal,
						toolFilter: { allow: [...DISCUSSION_TOOLS] },
						...agentOptions(),
					},
					signal: controller.signal,
				})
				record.childId = started.childId
				record.packAttached = true
			} catch (error) {
				return { ok: false, reason: 'create-failed', message: String(error?.message ?? error) }
			}
		} else {
			try {
				await deps.subagents.sendMessage(parent, record.childId, [{ type: 'text', text }], { signal: controller.signal })
			} catch (error) {
				return { ok: false, reason: 'send-failed', message: String(error?.message ?? error) }
			}
		}
		return {
			ok: true,
			token: record.token,
			childId: record.childId,
			running: record.childId !== undefined && statuses.get(record.childId) === 'running',
		}
	}

	/**
	 * Poll the transcript while the panel is open.
	 * @param input - the asking session and the request identity.
	 * @returns the transcript and the child's running state.
	 */
	async function transcript(input) {
		const resolved = resolve(input?.sessionId, input?.token)
		if (resolved.ok !== true) return resolved
		const record = resolved.record
		return {
			ok: true,
			token: record.token,
			childId: record.childId,
			messages: await readTranscript(record),
			running: record.childId !== undefined && statuses.get(record.childId) === 'running',
		}
	}

	/**
	 * Track the discussion child's running state from Host events.
	 * @param agentId - the Agent that changed status.
	 * @param status - its new status.
	 */
	function observeStatus(agentId, status) {
		if (typeof agentId !== 'string' || typeof status !== 'string') return
		if (!statuses.has(agentId) && !isTrackedChild(agentId)) return
		statuses.set(agentId, status)
	}

	/**
	 * Whether one Agent id is a live discussion child of some record.
	 * @param agentId - the Agent that changed status.
	 * @returns true for a child this service owns.
	 */
	function isTrackedChild(agentId) {
		for (const record of records.values()) {
			if (record.childId === agentId) return true
		}
		return false
	}

	/** Stop every discussion this plugin owns. */
	function dispose() {
		for (const record of [...records.values()]) interrupt(record)
		records.clear()
		statuses.clear()
	}

	return { begin, end, state, open, send, transcript, observeStatus, dispose }
}
