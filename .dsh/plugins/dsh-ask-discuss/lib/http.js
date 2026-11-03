/**
 * dsh-ask-discuss — the browser half's only Host channel.
 *
 * The Host action a discussion needs (create a subagent, deliver a message, read
 * a transcript) has no generated Remote face: Remotes are produced at build time
 * from decorated TypeScript, and this package is plain JavaScript. It therefore
 * claims one prefix route on the browser HTTP carrier, exactly as the shipped
 * attachment route does, and answers lossless JSON.
 *
 * The server carries no authentication of its own and binds loopback by default,
 * so the route trusts the `sessionId` it is given. Every operation behind it is
 * bounded by the running process: a Session with no pending question has no
 * record, and a discussion is only ever created for one.
 */

import { MAX_USER_TEXT } from './discussion.js'

/** Path prefix owned by this plugin. */
export const ROUTE_PREFIX = '/api/ask-discuss'

/** Largest request body accepted, in bytes. */
const MAX_BODY_BYTES = 256 * 1024

/**
 * Answer one request as JSON.
 * @param res - the carrier's response.
 * @param status - the HTTP status.
 * @param payload - the JSON body.
 */
function respond(res, status, payload) {
	res.statusCode = status
	res.setHeader('content-type', 'application/json; charset=utf-8')
	res.setHeader('cache-control', 'no-store')
	res.end(JSON.stringify(payload))
}

/**
 * Read and parse one JSON request body.
 * @param req - the carrier's request.
 * @returns the parsed object.
 * @throws when the body is absent, oversized, or not a JSON object.
 */
function readJson(req) {
	return new Promise((resolve, reject) => {
		const chunks = []
		let bytes = 0
		req.on('data', (chunk) => {
			bytes += chunk.length
			if (bytes > MAX_BODY_BYTES) {
				reject(new Error('request body too large'))
				req.destroy()
				return
			}
			chunks.push(chunk)
		})
		req.on('end', () => {
			const text = Buffer.concat(chunks).toString('utf8').trim()
			if (text === '') return resolve({})
			try {
				const parsed = JSON.parse(text)
				if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be a JSON object')
				resolve(parsed)
			} catch (error) {
				reject(error)
			}
		})
		req.on('error', reject)
	})
}

/**
 * Read the `sessionId` query parameter.
 * @param url - the parsed request URL.
 * @returns the session id, or undefined when absent or malformed.
 */
function querySessionId(url) {
	const value = url.searchParams.get('sessionId')
	return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Read the optional `token` query parameter.
 * @param url - the parsed request URL.
 * @returns the numeric request identity, or undefined.
 */
function queryToken(url) {
	const value = url.searchParams.get('token')
	if (value === null) return undefined
	const parsed = Number(value)
	return Number.isSafeInteger(parsed) ? parsed : undefined
}

/**
 * Dispatch one request to the discussion service.
 * @param discussions - the discussion service.
 * @param req - the carrier's request.
 * @param res - the carrier's response.
 */
async function handle(discussions, req, res) {
	const url = new URL(req.url ?? ROUTE_PREFIX, 'http://ask-discuss.local')
	const path = url.pathname.slice(ROUTE_PREFIX.length) || '/'
	try {
		if (req.method === 'GET' && path === '/state') {
			const sessionId = querySessionId(url)
			if (sessionId === undefined) return respond(res, 400, { ok: false, reason: 'bad-request' })
			return respond(res, 200, discussions.state(sessionId))
		}
		if (req.method === 'GET' && path === '/transcript') {
			const sessionId = querySessionId(url)
			if (sessionId === undefined) return respond(res, 400, { ok: false, reason: 'bad-request' })
			return respond(res, 200, await discussions.transcript({ sessionId, token: queryToken(url) }))
		}
		if (req.method === 'POST' && path === '/open') {
			const body = await readJson(req)
			if (typeof body.sessionId !== 'string' || body.sessionId === '') {
				return respond(res, 400, { ok: false, reason: 'bad-request' })
			}
			return respond(res, 200, await discussions.open({ sessionId: body.sessionId, token: numericToken(body.token) }))
		}
		if (req.method === 'POST' && path === '/send') {
			const body = await readJson(req)
			if (typeof body.sessionId !== 'string' || body.sessionId === '') {
				return respond(res, 400, { ok: false, reason: 'bad-request' })
			}
			if (typeof body.text !== 'string' || body.text.trim() === '') {
				return respond(res, 400, { ok: false, reason: 'empty-text' })
			}
			if (body.text.length > MAX_USER_TEXT) return respond(res, 200, { ok: false, reason: 'text-too-long' })
			return respond(res, 200, await discussions.send({ sessionId: body.sessionId, token: numericToken(body.token), text: body.text }))
		}
		return respond(res, 404, { ok: false, reason: 'not-found' })
	} catch (error) {
		return respond(res, 200, { ok: false, reason: 'internal', message: String(error?.message ?? error) })
	}
}

/**
 * Coerce a JSON token to the numeric request identity.
 * @param value - the parsed body's token.
 * @returns the token, or undefined when it is not a safe integer.
 */
function numericToken(value) {
	return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

/**
 * Claim the plugin's route on the browser HTTP carrier.
 * @param webServer - the carrier service.
 * @param discussions - the discussion service.
 * @returns the route's disposer.
 */
export function registerRoutes(webServer, discussions) {
	return webServer.register({
		kind: 'prefix',
		path: ROUTE_PREFIX,
		handler: (req, res) => handle(discussions, req, res),
	})
}
