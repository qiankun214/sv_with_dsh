/**
 * Verify the running `dsh web` process mounted the extension.
 *
 * Mints the browser-session cookie from the deployment's own credential record
 * (the same HMAC cookie `dsh web` issues after the token exchange), then reads
 * the served index boot graph and the plugin bundle.
 *
 * Run: node .dsh/plugins/dsh-markdown-media/test/verify-live.mjs [absolute-image-path]
 */
import { createHash, createHmac } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const home = process.env.HOME
const origin = process.env.DSH_WEB_URL ?? 'http://127.0.0.1:3080'
const authority = new URL(origin).host
const pluginId = 'dsh-markdown-media'

const credentials = fs.readFileSync(path.join(home, '.dsh/.credentials.yaml'), 'utf8')
const secretMatch = /client-connection\/browser-session:[\s\S]*?secret: ([A-Za-z0-9_-]+)/u.exec(credentials)
if (secretMatch === null) throw new Error('browser-session secret not found')
const secret = Buffer.from(secretMatch[1].replaceAll('-', '+').replaceAll('_', '/'), 'base64')

const b64url = (value) => Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
const body = b64url(JSON.stringify({
	version: 1,
	authority,
	issuedAt: Date.now(),
	expiresAt: Date.now() + 3600_000,
}))
const value = `v1.${body}.${b64url(createHmac('sha256', secret).update(body).digest())}`
const cookieName = `dsh-auth-${b64url(createHash('sha256').update(authority).digest())}`
const cookie = `${cookieName}=${value}`

const headers = { cookie, host: authority }

// 1 — the served index and its boot graph.
const indexResponse = await fetch(`${origin}/`, { headers, redirect: 'manual' })
const html = await indexResponse.text()
console.log(`index: HTTP ${indexResponse.status}, ${html.length} bytes`)
const bootMatch = /globalThis\["__DSH_BOOT__"\]\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/u.exec(html)
if (bootMatch === null) throw new Error('boot graph not found in index')
const boot = JSON.parse(bootMatch[1])
const rows = boot.entries ?? boot.plugins ?? []
const row = rows.find((entry) => (entry.id ?? '') === pluginId || (entry.id ?? '').startsWith(`${pluginId}/`))
if (row === undefined) {
	console.error('boot rows:', rows.map((entry) => entry.id))
	throw new Error(`${pluginId} is missing from the client boot graph`)
}
console.log(`boot graph: ${pluginId} present`, JSON.stringify(row))

// 2 — the bundle the browser will fetch.
const bundleUrl = row.url.startsWith('http') ? row.url : `${origin}${row.url}`
const bundleResponse = await fetch(bundleUrl, { headers })
const bundle = Buffer.from(await bundleResponse.arrayBuffer())
console.log(`bundle: HTTP ${bundleResponse.status}, ${bundle.byteLength} bytes, content-type ${bundleResponse.headers.get('content-type')}`)
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const local = fs.readFileSync(path.join(packageRoot, 'lib/client.js'))
const served = bundle.toString('utf8')
const marker = local.subarray(0, 120).toString('utf8').split('\n')[0]
console.log(`served combo carries the built bundle marker: ${served.includes(marker)} (${marker.length} chars)`)
console.log(`served combo registers a module: ${served.includes('__ModuleLoader__.load(')}`)
const zoomMarker = 'md-media-zoom-bar'
console.log(`served combo carries the click-to-enlarge viewer: ${served.includes(zoomMarker)}`)
if (bundleResponse.status !== 200 || !served.includes(marker)) throw new Error('served bundle is not the installed build')
if (!served.includes(zoomMarker)) throw new Error('served bundle predates the click-to-enlarge viewer')

// 3 — the image route the document preview now uses.
const sample = process.argv[2]
if (sample !== undefined) {
	const fileResponse = await fetch(`${origin}/api/file?path=${encodeURIComponent(sample)}`, { headers })
	const bytes = Buffer.from(await fileResponse.arrayBuffer())
	console.log(`api/file: HTTP ${fileResponse.status}, ${bytes.byteLength} bytes, content-type ${fileResponse.headers.get('content-type')}`)
	if (fileResponse.status !== 200) throw new Error('the /api/file route did not serve the sample image')
}
console.log('verify: OK')
