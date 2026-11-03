/**
 * dsh-ask-discuss — copy.
 *
 * The dictionary namespace is this package's own; `zh` is the primary text and
 * `en` is the checked-complete fallback. Keys are read through `copyOf`, so a
 * shell that does not know this namespace still renders meaningful copy instead
 * of raw keys.
 */

/** Locale namespace owned by this plugin. */
export const NS = 'askDiscuss'

export const zh = {
	'entry.label': '讨论',
	'entry.title': '和 Harness 讨论这道题（讨论不会进入主上下文）',
	'tab.title': '讨论',
	'panel.background': '讨论背景（只对这个窗口可见）',
	'panel.empty': '把你的疑问说清楚，讨论伙伴带着这道题和最近的对话回答你。',
	'panel.placeholder': '问点什么……（Enter 发送，Shift+Enter 换行）',
	'panel.send': '发送',
	'panel.sending': '发送中…',
	'panel.thinking': '正在回答…',
	'panel.loading': '正在准备讨论…',
	'panel.tool': '工具',
	'panel.failed': '失败',
	'reason.no-pending': '这道题刚刚已经被回答，或者已经取消了。',
	'reason.plan-review': '计划审批卡不接讨论，请直接在卡片上批准或拒绝。',
	'reason.parent-unavailable': '主会话已经不在运行，讨论开不起来。',
	'reason.stale': '问题已经换了一道，关掉这个窗口重新打开讨论。',
	'reason.empty-text': '先说点什么再发送。',
	'reason.text-too-long': '这段太长了，分几轮说吧。',
	'reason.unreachable': '连不上宿主：插件可能没有挂载，或者已经卸载。',
	'reason.create-failed': '讨论子代理起不来：{message}',
	'reason.send-failed': '消息没送到讨论伙伴：{message}',
	'reason.internal': '宿主内部错误：{message}',
	'reason.unknown': '出了点问题：{reason}',
}

export const en = {
	'entry.label': 'Discuss',
	'entry.title': 'Talk this question over with the Harness (the discussion stays out of the main context)',
	'tab.title': 'Discussion',
	'panel.background': 'Discussion background (visible only in this panel)',
	'panel.empty': 'Say what you are unsure about; the partner answers with this question and the recent conversation in hand.',
	'panel.placeholder': 'Ask something… (Enter sends, Shift+Enter breaks a line)',
	'panel.send': 'Send',
	'panel.sending': 'Sending…',
	'panel.thinking': 'Answering…',
	'panel.loading': 'Preparing the discussion…',
	'panel.tool': 'tool',
	'panel.failed': 'failed',
	'reason.no-pending': 'This question has already been answered or cancelled.',
	'reason.plan-review': 'Plan reviews stay on the native card; approve or refuse it there.',
	'reason.parent-unavailable': 'The main Session is no longer running, so the discussion cannot start.',
	'reason.stale': 'The question changed; close this panel and open the discussion again.',
	'reason.empty-text': 'Type something before sending.',
	'reason.text-too-long': 'That is too long for one message; split it up.',
	'reason.unreachable': 'Cannot reach the Host: the plugin is probably not mounted or already unloaded.',
	'reason.create-failed': 'The discussion subagent could not start: {message}',
	'reason.send-failed': 'The message did not reach the discussion partner: {message}',
	'reason.internal': 'Host error: {message}',
	'reason.unknown': 'Something went wrong: {reason}',
}
