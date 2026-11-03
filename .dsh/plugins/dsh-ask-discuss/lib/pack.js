/**
 * dsh-ask-discuss — the problem pack.
 *
 * The discussion partner starts with an empty conversation (the `spawn`
 * subagent backend never inherits parent context), so everything it knows about
 * the decision arrives in one text: the question as asked, the recent main
 * conversation, and the rules that keep it a discussion partner rather than a
 * second actor. This module owns that text and nothing else — it is pure, so the
 * shape of the pack is testable without a runtime.
 */

/** Text inserted between the pack and the user's opening line. */
export const PACK_SEPARATOR = '\n\n---\n\n'

/** Most main-conversation messages carried into the pack. */
export const PACK_MESSAGES = 10

/** Hard ceiling on the whole pack; a long conversation must not become the prompt. */
export const PACK_CHAR_LIMIT = 24000

/** Per-message limits used when reducing the asking session's surface. */
export const PACK_MESSAGE_LIMITS = Object.freeze({ textLimit: 1200, resultLimit: 400 })

/** Role rules the partner must hold for the whole discussion. */
const RULES = Object.freeze([
	'你只有只读工具（read / glob / grep / read_image / web_search / web_fetch / skill）：不能改文件、不能执行命令、不能派生别的代理。',
	'你无法向用户提问——这里没有提问通道。需要事实就自己查，查不到就直说你不确定。',
	'用户会回到原生卡片上自己点答案。你不负责提交答案，也不要说"我已经帮你选了"。',
	'每一轮直接回答用户当下问的东西，不要复述本段背景，不要寒暄。',
])

/**
 * Render one question's statement, detail, and options.
 * @param question - one `AskUserQuestionItem`.
 * @param index - zero-based position, rendered as the list number.
 * @returns the question's lines.
 */
function questionLines(question, index) {
	const lines = []
	const header = typeof question?.header === 'string' && question.header.trim() !== '' ? question.header.trim() : ''
	const body = typeof question?.question === 'string' ? question.question.trim() : ''
	lines.push(`### ${index + 1}. ${header === '' ? '问题' : header}`)
	if (body !== '') lines.push(body)
	if (typeof question?.detail === 'string' && question.detail.trim() !== '') {
		lines.push('')
		lines.push('说明：')
		lines.push(question.detail.trim())
	}
	const options = Array.isArray(question?.options) ? question.options : []
	if (options.length > 0) {
		lines.push('')
		lines.push(question?.multiSelect === true ? '选项（可多选）：' : '选项（单选）：')
		for (const option of options) {
			const label = typeof option?.label === 'string' ? option.label : String(option?.label ?? '')
			const description = typeof option?.description === 'string' ? option.description.trim() : ''
			lines.push(description === '' ? `- ${label}` : `- ${label} —— ${description}`)
		}
	}
	return lines
}

/**
 * Render one reduced message as a transcript line.
 * @param message - a message produced by `messagesOf`.
 * @returns the line, possibly spanning several rows.
 */
function messageLine(message) {
	if (message.role === 'user') return `[用户] ${message.text}`
	if (message.role === 'tool') {
		const failed = message.error === true ? '（失败）' : ''
		return `[工具 ${message.name}${failed}] ${message.text}`
	}
	const calls = Array.isArray(message.tools) && message.tools.length > 0 ? `（调用：${message.tools.join('、')}）` : ''
	return message.text === '' ? `[助手] ${calls}` : `[助手] ${message.text}${calls === '' ? '' : `\n${calls}`}`
}

/**
 * Build the discussion partner's opening context.
 * @param input - the pending questions and the reduced main-conversation messages.
 * @returns the pack text, prefixed to the user's first message.
 */
export function buildPack(input) {
	const questions = Array.isArray(input?.questions) ? input.questions : []
	const messages = Array.isArray(input?.messages) ? input.messages : []
	const parts = []
	parts.push('用户在 DeepSeek Harness 里向你提了一个问题，正在等他自己在卡片上作答。你的任务不是替他做决定，而是把这道题讲清楚，让他能自己判断。')
	parts.push('')
	parts.push('## 角色约束')
	for (const rule of RULES) parts.push(`- ${rule}`)
	parts.push('')
	parts.push('## 待决策的问题')
	for (const [index, question] of questions.entries()) {
		for (const line of questionLines(question, index)) parts.push(line)
		if (index < questions.length - 1) parts.push('')
	}
	parts.push('')
	parts.push('## 主会话最近的对话（原文节选，工具结果已截断）')
	if (messages.length === 0) {
		parts.push('（无可用的历史对话，只按上面的问题回答。）')
	} else {
		for (const message of messages) parts.push(messageLine(message))
	}
	const pack = parts.join('\n')
	return pack.length <= PACK_CHAR_LIMIT ? pack : `${pack.slice(0, PACK_CHAR_LIMIT)}…`
}

/**
 * Keep the pack's claim about "recent messages" honest without unbounded growth.
 * @param messages - every reduced message of the asking session.
 * @returns at most `PACK_MESSAGES` trailing messages.
 */
export function tailMessages(messages) {
	const list = Array.isArray(messages) ? messages : []
	return list.length <= PACK_MESSAGES ? list.slice() : list.slice(list.length - PACK_MESSAGES)
}
