/**
 * dsh-ask-discuss — Host half.
 *
 * The plugin observes the `user-questions/request` waterfall, and it only
 * observes: it records the pending request and returns whatever the composed
 * answerers below it return, so the shipped card keeps the answer surface and
 * this package never gains the ability to answer on the user's behalf.
 *
 * While such a request is pending, the browser half may ask this half — over one
 * prefix route, see `http.js` — to start a discussion: a continuable subagent on
 * the `spawn` backend whose only knowledge of the main Session is the problem
 * pack, and whose only reach into the workspace is the read-only tool set. That
 * subagent's conversation is a separate Session, so nothing said in the panel
 * ever enters the asking Session's context — only the user's own answer does.
 */

import { createDiscussionService } from './discussion.js'
import { registerRoutes } from './http.js'

export const name = 'dsh-ask-discuss'

/** The browser HTTP carrier is the only hard dependency; the rest are reported as reasons. */
export const inject = ['webServer']

/**
 * Host plugin body.
 * @param ctx - the Host Cordis context of this composition row.
 */
export function apply(ctx) {
	const discussions = createDiscussionService({
		get agents() {
			return ctx.get('agents')
		},
		get subagents() {
			return ctx.get('subagents')
		},
		get sessionQuery() {
			return ctx.get('sessionQuery')
		},
		get subagentModelSelection() {
			return ctx.get('subagentModelSelection')
		},
		logger: ctx.logger,
	})

	ctx.effect(() => () => discussions.dispose(), 'ask-discuss: discussion state')
	ctx.effect(() => registerRoutes(ctx.webServer, discussions), 'ask-discuss: browser route')

	ctx.on('user-questions/request', (request, next) => {
		const record = discussions.begin(request)
		if (record === undefined) return next()
		let settled
		try {
			settled = next()
		} catch (error) {
			discussions.end(record)
			throw error
		}
		if (settled === undefined || typeof settled.then !== 'function') {
			discussions.end(record)
			return settled
		}
		return settled.then(
			(answer) => {
				discussions.end(record)
				return answer
			},
			(error) => {
				discussions.end(record)
				throw error
			},
		)
	})

	ctx.on('agent/status', (payload) => {
		discussions.observeStatus(payload?.agent?.id, payload?.status)
	})
}
