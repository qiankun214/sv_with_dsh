import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { messagesOf, stripLeadingPack, textOf, toolCallsOf, truncate } from '../lib/messages.js'

/** One durable user message event. */
function userEvent(seq, text) {
	return { type: 'user/message', seq, data: { content: [{ type: 'text', text }] } }
}

/** One durable assistant message event. */
function assistantEvent(seq, blocks) {
	return { type: 'assistant/message', seq, data: { message: { content: blocks } } }
}

/** One durable tool result event. */
function toolEvent(seq, callId, text, error) {
	return {
		type: 'tool/result',
		seq,
		data: {
			message: { content: [{ type: 'tool-result', toolCallId: callId, content: [{ type: 'text', text }] }] },
			...(error === undefined ? {} : { error }),
		},
	}
}

describe('truncate', () => {
	it('leaves short text alone and marks a cut', () => {
		assert.equal(truncate('abc', 10), 'abc')
		assert.equal(truncate('abcdef', 4), 'abc…')
		assert.equal(truncate(undefined, 4), '')
		assert.equal(truncate('abcdef', 0), 'abcdef')
	})
})

describe('textOf and toolCallsOf', () => {
	it('joins text blocks and ignores everything else', () => {
		assert.equal(textOf([{ type: 'text', text: 'a' }, { type: 'reasoning', text: 'r' }, { type: 'text', text: 'b' }]), 'a\nb')
		assert.equal(textOf(undefined), '')
		assert.equal(textOf([null, 3]), '')
	})

	it('lists called tool names in order', () => {
		const blocks = [{ type: 'tool-call', id: 'c1', name: 'read' }, { type: 'text', text: 'x' }, { type: 'tool-call', id: 'c2', name: 'grep' }]
		assert.deepEqual(toolCallsOf(blocks), ['read', 'grep'])
	})
})

describe('messagesOf', () => {
	it('reduces the four surface types and drops system messages', () => {
		const events = [
			{ type: 'system/message', seq: 0, data: { message: { content: [{ type: 'text', text: 'prompt' }] } } },
			userEvent(1, 'question'),
			assistantEvent(2, [{ type: 'text', text: 'let me look' }, { type: 'tool-call', id: 'c1', name: 'read' }]),
			toolEvent(3, 'c1', 'file body'),
		]
		const messages = messagesOf(events)
		assert.equal(messages.length, 3)
		assert.deepEqual(messages[0], { seq: 1, role: 'user', text: 'question', tools: [] })
		assert.deepEqual(messages[1], { seq: 2, role: 'assistant', text: 'let me look', tools: ['read'] })
		assert.equal(messages[2].role, 'tool')
		assert.equal(messages[2].name, 'read')
		assert.equal(messages[2].text, 'file body')
		assert.equal(messages[2].error, false)
	})

	it('keeps an assistant message that only called tools', () => {
		const messages = messagesOf([assistantEvent(1, [{ type: 'tool-call', id: 'c1', name: 'glob' }])])
		assert.deepEqual(messages, [{ seq: 1, role: 'assistant', text: '', tools: ['glob'] }])
	})

	it('flags a failed tool result and names an unknown call', () => {
		const messages = messagesOf([toolEvent(1, 'missing', 'boom', { name: 'ToolError', code: 'x' })])
		assert.equal(messages[0].name, 'tool')
		assert.equal(messages[0].error, true)
	})

	it('applies the caller limits', () => {
		const messages = messagesOf([userEvent(1, 'y'.repeat(50)), toolEvent(2, 'c', 'z'.repeat(50))], {
			textLimit: 10,
			resultLimit: 5,
		})
		assert.equal(messages[0].text.length, 10)
		assert.equal(messages[1].text.length, 5)
	})
})

describe('stripLeadingPack', () => {
	it('removes pack plus separator from the first user message only', () => {
		const events = [userEvent(1, 'PACK\n\n---\n\nhello'), userEvent(2, 'second')]
		const stripped = stripLeadingPack(events, 'PACK', '\n\n---\n\n')
		assert.deepEqual(textOf(stripped[0].data.content), 'hello')
		assert.deepEqual(textOf(stripped[1].data.content), 'second')
		assert.deepEqual(textOf(events[0].data.content), 'PACK\n\n---\n\nhello')
	})

	it('falls back to the pack alone when the separator is missing', () => {
		const stripped = stripLeadingPack([userEvent(1, 'PACK\n---\nnothing else')], 'PACK', '\n\n---\n\n')
		assert.equal(textOf(stripped[0].data.content), 'nothing else')
	})

	it('is a no-op without a pack or without events', () => {
		const events = [userEvent(1, 'hello')]
		assert.equal(stripLeadingPack(events, '', '\n\n---\n\n'), events)
		assert.deepEqual(stripLeadingPack(undefined, 'PACK', '\n\n---\n\n'), [])
	})
})
