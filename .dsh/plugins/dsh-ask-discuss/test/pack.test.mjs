import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildPack, PACK_CHAR_LIMIT, PACK_MESSAGES, tailMessages } from '../lib/pack.js'

const questions = [
	{
		id: 'q1',
		header: '存储格式',
		question: '草稿用哪种格式存？',
		detail: '页面刷新后草稿要还能回来。',
		options: [
			{ label: '存 Host', description: '跨设备一致，但要写接口。' },
			{ label: '只留内存' },
		],
	},
	{
		id: 'q2',
		header: '范围',
		question: '要不要连审批卡一起做？',
		multiSelect: true,
		options: [{ label: '要' }, { label: '不要' }],
	},
]

describe('buildPack', () => {
	it('states the role rules before the question', () => {
		const pack = buildPack({ questions, messages: [] })
		assert.match(pack, /## 角色约束/)
		assert.match(pack, /只读工具/)
		assert.match(pack, /没有提问通道/)
		assert.ok(pack.indexOf('## 角色约束') < pack.indexOf('## 待决策的问题'))
	})

	it('renders headers, detail, options and the multi-select marker', () => {
		const pack = buildPack({ questions, messages: [] })
		assert.match(pack, /### 1\. 存储格式/)
		assert.match(pack, /草稿用哪种格式存？/)
		assert.match(pack, /说明：\n页面刷新后草稿要还能回来。/)
		assert.match(pack, /- 存 Host —— 跨设备一致，但要写接口。/)
		assert.match(pack, /- 只留内存\n/)
		assert.match(pack, /### 2\. 范围/)
		assert.match(pack, /选项（可多选）：/)
	})

	it('falls back to a generic heading when a question has no header', () => {
		const pack = buildPack({ questions: [{ id: 'q', question: '继续吗？' }], messages: [] })
		assert.match(pack, /### 1\. 问题/)
	})

	it('renders the reduced conversation with tool calls and tool results', () => {
		const pack = buildPack({
			questions,
			messages: [
				{ role: 'user', text: '看下这个文件', tools: [] },
				{ role: 'assistant', text: '我读一下。', tools: ['read'] },
				{ role: 'tool', name: 'read', text: 'module body', error: false },
			],
		})
		assert.match(pack, /\[用户\] 看下这个文件/)
		assert.match(pack, /\[助手\] 我读一下。\n（调用：read）/)
		assert.match(pack, /\[工具 read\] module body/)
	})

	it('marks failed tool results', () => {
		const pack = buildPack({ questions, messages: [{ role: 'tool', name: 'grep', text: 'nope', error: true }] })
		assert.match(pack, /\[工具 grep（失败）\] nope/)
	})

	it('says so when there is no history', () => {
		const pack = buildPack({ questions, messages: [] })
		assert.match(pack, /（无可用的历史对话，只按上面的问题回答。）/)
	})

	it('never exceeds the character ceiling', () => {
		const messages = Array.from({ length: 40 }, () => ({ role: 'user', text: 'x'.repeat(1200), tools: [] }))
		const pack = buildPack({ questions, messages })
		assert.equal(pack.length, PACK_CHAR_LIMIT + 1)
		assert.ok(pack.endsWith('…'))
	})
})

describe('tailMessages', () => {
	it('keeps the newest messages when the list is long', () => {
		const messages = Array.from({ length: PACK_MESSAGES + 5 }, (_, index) => ({ role: 'user', text: `m${index}`, tools: [] }))
		const tail = tailMessages(messages)
		assert.equal(tail.length, PACK_MESSAGES)
		assert.deepEqual(
			tail.map((message) => message.text),
			messages.slice(-PACK_MESSAGES).map((message) => message.text),
		)
	})

	it('returns a copy for a short list and tolerates non-lists', () => {
		const message = { role: 'user', text: 'one', tools: [] }
		const tail = tailMessages([message])
		assert.notEqual(tail, [message])
		assert.deepEqual(tailMessages(undefined), [])
	})
})
