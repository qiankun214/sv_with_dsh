/**
 * dsh-ask-discuss — the discussion panel.
 *
 * The body of this package's right-Sidebar tab, and what a floating panel shows
 * once the tab is floated. It owns no discussion state of its own: the Host half
 * is authoritative for whether a request is pending and for the partner's
 * transcript, so the panel opens once, polls while it is mounted, and closes
 * itself when the pending interaction it was opened from is gone.
 *
 * Nothing here ever answers the original question. The user does that on the
 * native card; this panel only makes the decision cheaper to think about.
 */

/** How often the panel re-reads the partner's transcript, in milliseconds. */
const POLL_MS = 700

/**
 * Build the panel component.
 * @param options - React, copy, transport, the Markdown renderer, and the pending hook.
 * @returns the tab body component.
 */
export function createPanel(options) {
	const { React, copy, transport, MarkdownText, usePending } = options
	const h = React.createElement

	/**
	 * Render one transcript entry.
	 * @param message - a message produced by the Host half.
	 * @param index - its position, used for the React key.
	 * @returns the rendered bubble.
	 */
	function bubble(message, index) {
		const key = message?.seq ?? index
		if (message?.role === 'user') {
			return h('div', { key, className: 'dsad-bubble dsad-user' }, message.text)
		}
		if (message?.role === 'tool') {
			const label = `${copy.t('panel.tool')} ${message.name ?? ''}${message.error === true ? ` · ${copy.t('panel.failed')}` : ''}`.trim()
			return h(
				'div',
				{ key, className: 'dsad-tool' },
				h('div', null, label),
				typeof message.text === 'string' && message.text !== '' ? h('pre', null, message.text) : null,
			)
		}
		const text = typeof message?.text === 'string' ? message.text : ''
		return h(
			'div',
			{ key, className: 'dsad-bubble dsad-assistant' },
			MarkdownText !== undefined && text !== ''
				? h(MarkdownText, { text })
				: h('div', { style: { whiteSpace: 'pre-wrap' } }, text),
		)
	}

	/**
	 * The tab body.
	 * @param props - standard Session props, the tab-info hook, and Host handlers.
	 * @returns the panel.
	 */
	return function AskDiscussPanel(props) {
		const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : undefined
		const info = typeof props?.tabInfo === 'function' ? props.tabInfo() : undefined
		const pending = usePending(props)
		const [view, setView] = React.useState({ phase: 'loading', pack: '', messages: [], running: false, childId: undefined, error: undefined })
		const [draft, setDraft] = React.useState('')
		const [sending, setSending] = React.useState(false)
		const tokenRef = React.useRef(undefined)
		const aliveRef = React.useRef(true)
		const seenPendingRef = React.useRef(false)
		const closingRef = React.useRef(false)
		const scrollRef = React.useRef(undefined)

		React.useEffect(() => {
			aliveRef.current = true
			let cancelled = false
			if (sessionId === undefined) {
				setView({ phase: 'error', pack: '', messages: [], running: false, childId: undefined, error: { reason: 'unreachable' } })
				return () => {
					cancelled = true
				}
			}
			transport.open({ sessionId }).then((payload) => {
				if (cancelled) return
				if (payload.ok !== true) {
					setView({ phase: 'error', pack: '', messages: [], running: false, childId: undefined, error: payload })
					return
				}
				tokenRef.current = payload.token
				setView({
					phase: 'ready',
					pack: typeof payload.pack === 'string' ? payload.pack : '',
					messages: Array.isArray(payload.messages) ? payload.messages : [],
					running: payload.running === true,
					childId: payload.childId,
					error: undefined,
				})
			})
			return () => {
				cancelled = true
				aliveRef.current = false
			}
		}, [sessionId])

		React.useEffect(() => {
			// Before the first message the partner does not exist yet; nothing to poll.
			if (view.phase !== 'ready' || sessionId === undefined || view.childId === undefined) return undefined
			const timer = setInterval(() => {
				transport.transcript({ sessionId, token: tokenRef.current }).then((payload) => {
					if (!aliveRef.current) return
					if (payload.ok !== true) {
						// The request ended or was replaced: the pending watcher below closes the panel.
						if (payload.reason === 'no-pending' || payload.reason === 'stale') return
						setView((previous) => ({ ...previous, error: payload }))
						return
					}
					setView((previous) => ({
						...previous,
						messages: Array.isArray(payload.messages) ? payload.messages : previous.messages,
						running: payload.running === true,
						childId: payload.childId ?? previous.childId,
						error: undefined,
					}))
				})
			}, POLL_MS)
			return () => clearInterval(timer)
		}, [sessionId, view.phase, view.childId])

		React.useEffect(() => {
			if (pending !== undefined) {
				seenPendingRef.current = true
				return
			}
			if (!seenPendingRef.current || closingRef.current) return
			closingRef.current = true
			info?.tab?.actions?.close?.()
		}, [pending])

		React.useEffect(() => {
			const element = scrollRef.current
			if (element === undefined || element === null) return
			element.scrollTop = element.scrollHeight
		}, [view.messages.length, view.running])

		const submit = React.useCallback(() => {
			const text = draft.trim()
			if (text === '' || sending || sessionId === undefined) return
			setSending(true)
			transport.send({ sessionId, token: tokenRef.current, text }).then((payload) => {
				if (!aliveRef.current) return
				setSending(false)
				if (payload.ok !== true) {
					setView((previous) => ({ ...previous, error: payload }))
					return
				}
				tokenRef.current = payload.token
				setDraft('')
				setView((previous) => ({
					...previous,
					error: undefined,
					running: payload.running === true,
					childId: payload.childId ?? previous.childId,
				}))
			})
		}, [draft, sending, sessionId])

		const onKeyDown = React.useCallback(
			(event) => {
				if (event.key !== 'Enter' || event.shiftKey) return
				if (event.nativeEvent !== undefined && event.nativeEvent.isComposing === true) return
				event.preventDefault()
				submit()
			},
			[submit],
		)

		const children = []
		if (view.pack !== '') {
			children.push(
				h('details', { key: 'pack', className: 'dsad-pack' }, h('summary', null, copy.t('panel.background')), h('pre', null, view.pack)),
			)
		}
		if (view.phase === 'loading') children.push(h('div', { key: 'loading', className: 'dsad-hint' }, copy.t('panel.loading')))
		if (view.phase === 'ready' && view.messages.length === 0) {
			children.push(h('div', { key: 'empty', className: 'dsad-hint' }, copy.t('panel.empty')))
		}
		for (const [index, message] of view.messages.entries()) children.push(bubble(message, index))
		if (view.running) children.push(h('div', { key: 'running', className: 'dsad-running' }, copy.t('panel.thinking')))
		if (view.error !== undefined) children.push(h('div', { key: 'error', className: 'dsad-error' }, copy.reason(view.error)))

		return h(
			'div',
			{ className: 'dsad-panel' },
			h('div', { className: 'dsad-scroll', ref: scrollRef }, children),
			h(
				'div',
				{ className: 'dsad-compose' },
				h('textarea', {
					className: 'dsad-input',
					value: draft,
					placeholder: copy.t('panel.placeholder'),
					onChange: (event) => setDraft(event.target.value),
					onKeyDown,
				}),
				h(
					'div',
					{ className: 'dsad-actions' },
					h(
						'button',
						{ type: 'button', className: 'dsad-send', disabled: sending || draft.trim() === '', onClick: submit },
						sending ? copy.t('panel.sending') : copy.t('panel.send'),
					),
				),
			),
		)
	}
}
