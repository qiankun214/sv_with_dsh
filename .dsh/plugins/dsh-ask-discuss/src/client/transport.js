/**
 * dsh-ask-discuss — the browser half's Host channel.
 *
 * Every call answers a payload with an `ok` flag; failures are values, not
 * exceptions, because every one of them is something the panel must render. A
 * carrier that never answers is folded into the same shape as an `unreachable`
 * reason, which is also what a missing Host half produces.
 */

/** Path prefix the Host half claims. */
export const API_PREFIX = '/api/ask-discuss'

/**
 * Create the transport over one `fetch`-compatible implementation.
 * @param options - optional fetch implementation and path prefix.
 * @returns the four Host calls the panel makes.
 */
export function createTransport(options = {}) {
	const doFetch = options.fetchImpl ?? ((...args) => fetch(...args))
	const prefix = options.prefix ?? API_PREFIX

	/**
	 * Run one request and fold transport failures into a reason.
	 * @param path - path below the prefix.
	 * @param init - fetch init.
	 * @returns the parsed payload, or an `unreachable` refusal.
	 */
	async function request(path, init) {
		try {
			const response = await doFetch(`${prefix}${path}`, init)
			if (!response.ok) return { ok: false, reason: 'unreachable', message: `HTTP ${response.status}` }
			const payload = await response.json()
			if (payload === null || typeof payload !== 'object') return { ok: false, reason: 'internal', message: 'malformed payload' }
			return payload
		} catch (error) {
			return { ok: false, reason: 'unreachable', message: String(error?.message ?? error) }
		}
	}

	/**
	 * Read whether one Session waits on a discussable question.
	 * @param sessionId - the asking session.
	 * @returns the pending flag and request identity.
	 */
	function state(sessionId) {
		return request(`/state?sessionId=${encodeURIComponent(sessionId)}`, { method: 'GET' })
	}

	/**
	 * Open the panel payload: the pack, the transcript so far, and running state.
	 * @param input - session id and the request identity the panel holds, if any.
	 * @returns the payload.
	 */
	function open(input) {
		return request('/open', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ sessionId: input.sessionId, token: input.token }),
		})
	}

	/**
	 * Deliver one user message.
	 * @param input - session id, request identity, and the text.
	 * @returns the payload.
	 */
	function send(input) {
		return request('/send', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ sessionId: input.sessionId, token: input.token, text: input.text }),
		})
	}

	/**
	 * Poll the transcript while the panel is open.
	 * @param input - session id and request identity.
	 * @returns the transcript payload.
	 */
	function transcript(input) {
		const query = [`sessionId=${encodeURIComponent(input.sessionId)}`]
		if (typeof input.token === 'number') query.push(`token=${input.token}`)
		return request(`/transcript?${query.join('&')}`, { method: 'GET' })
	}

	return { state, open, send, transcript }
}
