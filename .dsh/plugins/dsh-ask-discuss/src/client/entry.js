/**
 * dsh-ask-discuss — the Session header entry.
 *
 * The discussion is entered from the conversation header rather than from the
 * question card: that card takes over the whole composer chain, and the composer
 * bar it replaces is the only nearby seat a plugin could otherwise use. The
 * header stays visible for exactly as long as a question waits, so the entry
 * appears with the question and disappears with it.
 */

/**
 * Build the entry component.
 * @param options - React, copy, the pending hook, and the open action.
 * @returns the header-utilities entry component.
 */
export function createEntry(options) {
	const { React, copy, usePending, open } = options
	const h = React.createElement

	/**
	 * The header entry.
	 * @param props - standard Session props and the Host action.
	 * @returns the button while an ordinary question waits, otherwise nothing.
	 */
	return function AskDiscussEntry(props) {
		const pending = usePending(props)
		const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : undefined
		if (sessionId === undefined) return null
		// Only ordinary questions get a discussion: plan reviews and tool approvals
		// keep their own answer surfaces.
		if (pending === undefined || pending.kind !== 'question') return null
		return h(
			'button',
			{
				type: 'button',
				className: 'dsad-entry',
				title: copy.t('entry.title'),
				onClick: () => open(sessionId),
			},
			h('span', { className: 'dsad-entry-dot' }),
			h('span', null, copy.t('entry.label')),
		)
	}
}

/**
 * Read one Session's pending interaction through the shell's standard hook.
 *
 * The hook arrives as a standard prop on every slot component, so this is a
 * plain helper rather than a registered service: no network, no polling, and it
 * re-renders the entry the moment the interaction is answered.
 * @param props - a slot component's props.
 * @returns the pending interaction, or undefined when nothing waits.
 */
export function readPendingInteraction(props) {
	const useSessionPendingInteraction = props?.useSessionPendingInteraction
	const sessionId = props?.sessionId
	if (typeof useSessionPendingInteraction !== 'function' || typeof sessionId !== 'string') return undefined
	return useSessionPendingInteraction((snapshot) => (snapshot === undefined || snapshot === null ? undefined : snapshot.get(sessionId)))
}
