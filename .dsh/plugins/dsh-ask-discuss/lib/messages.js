/**
 * dsh-ask-discuss — Session-event helpers.
 *
 * Two consumers read the same two Session surfaces, and both need the same
 * reduction from durable surface events to line-oriented messages:
 *
 * - the problem pack, built from the ASKING session's current surface so the
 *   discussion partner knows what the user was just doing;
 * - the discussion transcript, built from the CHILD session's surface so the
 *   panel can draw the conversation.
 *
 * They differ only in how much text each keeps, so the limits are options here
 * rather than constants at the call sites. Tool results are matched back to
 * their tool name through the `tool-call` blocks of earlier assistant messages:
 * a `tool/result` event records only the call id.
 */

/** Text kept per ordinary message when no explicit limit is given. */
const DEFAULT_TEXT_LIMIT = 1200
/** Text kept per tool result when no explicit limit is given. */
const DEFAULT_RESULT_LIMIT = 400

/**
 * Shorten one text to at most `limit` characters, marking the cut.
 * @param text - the text to shorten.
 * @param limit - maximum characters in the result.
 * @returns the original text, or its head plus an ellipsis.
 */
export function truncate(text, limit) {
	const value = typeof text === 'string' ? text : ''
	if (!Number.isFinite(limit) || limit <= 0 || value.length <= limit) return value
	return `${value.slice(0, Math.max(0, limit - 1))}…`
}

/**
 * Join the text blocks of one content array.
 * @param blocks - content blocks, possibly absent or malformed.
 * @returns the trimmed text, with one newline between blocks.
 */
export function textOf(blocks) {
	if (!Array.isArray(blocks)) return ''
	const parts = []
	for (const block of blocks) {
		if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
			parts.push(block.text)
		}
	}
	return parts.join('\n').trim()
}

/**
 * Names of the tool calls carried by one content array, in order.
 * @param blocks - content blocks, possibly absent or malformed.
 * @returns the called tool names.
 */
export function toolCallsOf(blocks) {
	if (!Array.isArray(blocks)) return []
	const names = []
	for (const block of blocks) {
		if (block !== null && typeof block === 'object' && block.type === 'tool-call' && typeof block.name === 'string') {
			names.push(block.name)
		}
	}
	return names
}

/**
 * Index every tool call id to its tool name across the given events.
 * @param events - surface events in ascending order.
 * @returns call id to tool name.
 */
function toolNamesById(events) {
	const names = new Map()
	for (const event of events) {
		if (event?.type !== 'assistant/message') continue
		for (const block of event.data?.message?.content ?? []) {
			if (block?.type === 'tool-call' && typeof block.id === 'string' && typeof block.name === 'string') {
				names.set(block.id, block.name)
			}
		}
	}
	return names
}

/**
 * Reduce surface events to line-oriented messages.
 *
 * Only the four surface event types exist, and `system/message` is dropped: the
 * child's own system prompt is not conversation, and the asking session's is
 * already summarised by the pack's role rules.
 * @param events - surface events in ascending order.
 * @param options - optional per-role text limits.
 * @returns one message per user, assistant, or tool-result event.
 */
export function messagesOf(events, options = {}) {
	const list = Array.isArray(events) ? events : []
	const textLimit = options.textLimit ?? DEFAULT_TEXT_LIMIT
	const resultLimit = options.resultLimit ?? DEFAULT_RESULT_LIMIT
	const names = toolNamesById(list)
	const messages = []
	for (const event of list) {
		if (event?.type === 'user/message') {
			const text = textOf(event.data?.content)
			if (text !== '') messages.push({ seq: event.seq, role: 'user', text: truncate(text, textLimit), tools: [] })
			continue
		}
		if (event?.type === 'assistant/message') {
			const blocks = event.data?.message?.content
			const text = textOf(blocks)
			const tools = toolCallsOf(blocks)
			if (text !== '' || tools.length > 0) {
				messages.push({ seq: event.seq, role: 'assistant', text: truncate(text, textLimit), tools })
			}
			continue
		}
		if (event?.type === 'tool/result') {
			const block = event.data?.message?.content?.[0]
			const name = names.get(block?.toolCallId) ?? 'tool'
			const text = textOf(block?.content)
			messages.push({
				seq: event.seq,
				role: 'tool',
				name,
				text: truncate(text, resultLimit),
				error: event.data?.error !== undefined,
			})
		}
	}
	return messages
}

/**
 * Remove the problem pack from the first user message of a discussion log.
 *
 * The child's first prompt is the pack and the user's opening line in one
 * message, so the transcript would otherwise repeat the whole pack above the
 * conversation. Matching is a plain prefix test: the host wrote that prefix
 * itself and the log is append-only.
 * @param events - the child session's surface events, in ascending order.
 * @param pack - the exact pack text the host prepended.
 * @param separator - the exact separator the host inserted.
 * @returns a shallow copy whose first user message carries only the user's text.
 */
export function stripLeadingPack(events, pack, separator) {
	if (typeof pack !== 'string' || pack === '') return Array.isArray(events) ? events : []
	const prefix = `${pack}${separator}`
	let stripped = false
	const result = []
	for (const event of Array.isArray(events) ? events : []) {
		if (!stripped && event?.type === 'user/message') {
			stripped = true
			result.push({ ...event, data: { ...event.data, content: stripFromBlocks(event.data?.content, prefix, pack) } })
			continue
		}
		result.push(event)
	}
	return result
}

/**
 * Remove the pack prefix from one content array's first text block.
 * @param blocks - the user message's content blocks.
 * @param prefix - pack plus separator.
 * @param pack - the pack alone, for a log where the separator is missing.
 * @returns the blocks with the leading pack removed.
 */
function stripFromBlocks(blocks, prefix, pack) {
	if (!Array.isArray(blocks)) return blocks
	let done = false
	return blocks.map((block) => {
		if (done || block?.type !== 'text' || typeof block.text !== 'string') return block
		done = true
		let text = block.text
		if (text.startsWith(prefix)) text = text.slice(prefix.length)
		else if (text.startsWith(pack)) text = text.slice(pack.length).replace(/^\s*---\s*/, '')
		return { ...block, text }
	})
}
