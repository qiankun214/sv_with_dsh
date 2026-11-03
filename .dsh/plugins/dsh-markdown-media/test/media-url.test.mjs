/**
 * Unit tests for the media-URL helpers: the pure half of the document-preview
 * image fix. Run with `node test/media-url.test.mjs`.
 */
import assert from 'node:assert/strict'
import { documentAbsolutePath, mediaUrl, normalizePath } from '../src/client/media-url.js'

// The resolver only reads the origin; stub it like a page at the Web GUI.
globalThis.window = { location: { origin: 'http://127.0.0.1:3080' } }

const origin = 'http://127.0.0.1:3080'
const doc = '/home/alpaca/sv/01-requirements/REQ-001-rr-arbitration.md'
const expected = (path) => `${origin}/api/file?path=${encodeURIComponent(path)}`

const cases = [
	// Relative destination, resolved against the open document's directory.
	['relative', 'REQ-001-rr-arbitration/scenario-1-single-request.svg',
		expected('/home/alpaca/sv/01-requirements/REQ-001-rr-arbitration/scenario-1-single-request.svg')],
	// Leading `./` and a nested parent walk.
	['dot-relative', './img/a.png', expected('/home/alpaca/sv/01-requirements/img/a.png')],
	['parent-relative', '../assets/a.png', expected('/home/alpaca/sv/assets/a.png')],
	// Absolute destination.
	['absolute', '/home/alpaca/sv/docs/a.png', expected('/home/alpaca/sv/docs/a.png')],
	// Percent-encoded destination and non-ASCII file name.
	['encoded', 'my%20folder/a%20b.png', expected('/home/alpaca/sv/01-requirements/my folder/a b.png')],
	['cjk', '图示/时序.svg', expected('/home/alpaca/sv/01-requirements/图示/时序.svg')],
	// Query and fragment belong to the page, not the file.
	['fragment', 'a.svg#page=2', expected('/home/alpaca/sv/01-requirements/a.svg')],
	// Remote and inline destinations pass through untouched.
	['http', 'https://example.com/a.png', 'https://example.com/a.png'],
	['data', 'data:image/png;base64,AAAA', 'data:image/png;base64,AAAA'],
	// A protocol-relative destination is not a Host file.
	['protocol-relative', '//cdn.example.com/a.png', undefined],
	// An unknown document path cannot anchor a relative destination.
	['unresolvable', 'a.png', undefined, null],
]

for (const [name, value, want, docPath = doc] of cases) {
	const got = mediaUrl(docPath, value)
	assert.equal(got, want, `${name}: mediaUrl(${JSON.stringify(docPath)}, ${JSON.stringify(value)})`)
}

assert.equal(normalizePath('/a/./b/../c//d'), '/a/c/d')
assert.equal(normalizePath('a/../../b'), 'b')

// The document path comes from the resource snapshot when the Host supplies it,
// and from an absolute path inside the address otherwise.
const snapshot = { status: 'ready', value: { absolutePath: '/srv/work/docs/a.md' } }
assert.equal(documentAbsolutePath('dsh-resource://file/session/s1/docs/a.md', snapshot), '/srv/work/docs/a.md')
assert.equal(documentAbsolutePath('dsh-resource://file/session/s1//srv/work/docs/a.md', { status: 'none' }), '/srv/work/docs/a.md')
assert.equal(
	documentAbsolutePath('dsh-resource://file/session/s1/REQ-002-ip-udp-parser.md', { status: 'none' }),
	undefined,
)
assert.equal(
	documentAbsolutePath('dsh-resource://file/session/s1/%E5%9B%BE%E7%A4%BA/a.md', { status: 'none' }),
	undefined,
)
assert.equal(
	documentAbsolutePath('dsh-resource://file/session/s1/%2Ftmp%2F%E5%9B%BE/a.md', { status: 'loading' }),
	'/tmp/图/a.md',
)

console.log(`media-url: ${cases.length + 6} checks passed`)
