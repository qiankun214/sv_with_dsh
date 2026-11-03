/**
 * Build the browser bundle for dsh-markdown-media.
 *
 * The output is one classic script that registers the package's plugin factory
 * with `window.__ModuleLoader__.load`, which is the only shape
 * `@deepseek-ai/dsh-client-modules` loads. React and the primitive library stay
 * external: the loader's frozen table supplies both, so they are never bundled
 * twice.
 *
 * The same run regenerates `THIRD-PARTY-NOTICES.md` from esbuild's metafile.
 * The bundle inlines Mermaid and its dependency closure, and the build strips
 * comments, so the notices file is what carries each package's copyright and
 * licence text into the distributed package: MIT and ISC both require it.
 *
 * Usage: pnpm install && node build.mjs
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

/** Where the bundled packages' licence texts end up. */
const NOTICES_FILE = 'THIRD-PARTY-NOTICES.md'
/** Files npm packages conventionally ship their licence in. */
const LICENSE_FILES = [
	'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT', 'LICENSE-ISC',
	'LICENCE', 'LICENCE.md', 'LICENCE.txt',
	'license', 'license.md', 'license.txt', 'license-mit', 'license-isc',
	'COPYING', 'COPYING.md', 'copying', 'copying.md',
]

const result = await build({
	entryPoints: ['src/client/index.js'],
	outfile: 'lib/client.js',
	bundle: true,
	format: 'iife',
	platform: 'browser',
	target: ['chrome120', 'firefox120', 'safari17'],
	minify: true,
	legalComments: 'none',
	sourcemap: false,
	// `require` is the loader's factory argument, never a bundled module request.
	external: [],
	define: { 'process.env.NODE_ENV': '"production"' },
	banner: { js: '/* dsh-markdown-media: browser bundle, built by build.mjs */' },
	metafile: true,
	logLevel: 'info',
})

/**
 * Map one metafile input path to the package that owns it.
 * @param input - an esbuild metafile input path, `/`-separated.
 * @returns the package name and directory, or `undefined` for first-party code.
 */
function packageDirOf(input) {
	const normalized = input.replace(/\\/g, '/')
	const marker = 'node_modules/'
	const at = normalized.lastIndexOf(marker)
	if (at < 0) return undefined
	const rest = normalized.slice(at + marker.length)
	const segments = rest.split('/')
	const nameLength = segments[0]?.startsWith('@') === true ? 2 : 1
	const name = segments.slice(0, nameLength).join('/')
	if (name === '') return undefined
	return { name, dir: path.resolve(normalized.slice(0, at + marker.length), name) }
}

/**
 * Read the licence section some packages keep only in their README.
 * @param dir - absolute package directory.
 * @returns the section body, or `undefined` when there is none.
 */
function licenseFromReadme(dir) {
	const file = path.join(dir, 'README.md')
	if (!fs.existsSync(file)) return undefined
	const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
	const match = /^#{1,6}\s*(?:license|licence)\b[^\n]*\n([\s\S]*)$/im.exec(text)
	if (match === null) return undefined
	const nextHeading = /^#{1,6}\s/m.exec(match[1])
	const body = (nextHeading === null ? match[1] : match[1].slice(0, nextHeading.index)).trim()
	return body === '' ? undefined : body
}

/**
 * Read one package's licence text, preferring a dedicated file.
 * @param dir - absolute package directory.
 * @returns the licence text, or `undefined` when the package ships none.
 */
function licenseOf(dir) {
	for (const candidate of LICENSE_FILES) {
		const file = path.join(dir, candidate)
		if (!fs.existsSync(file)) continue
		const text = fs.readFileSync(file, 'utf8').trim()
		if (text !== '') return text
	}
	return licenseFromReadme(dir)
}

const packages = new Map()
for (const input of Object.keys(result.metafile.inputs)) {
	const found = packageDirOf(input)
	if (found === undefined) continue
	packages.set(found.name, found.dir)
}

const missing = []
const sections = []
for (const [name, dir] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
	let manifest
	try {
		manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
	} catch {
		continue
	}
	const license = manifest.license
		?? manifest.licenses?.map((entry) => entry.type).join(' / ')
		?? '见仓库'
	const text = licenseOf(dir)
	if (text === undefined) missing.push(name)
	sections.push([
		`## ${name} ${manifest.version ?? ''} — ${license}`,
		'',
		text ?? '本包未随附许可证文件，见其 npm 页面。',
		'',
	].join('\n'))
}

if (missing.length > 0) {
	process.stderr.write(`build: warning: no licence file found for ${missing.join(', ')}\n`)
}

const notices = [
	'# 第三方组件声明',
	'',
	'本包的浏览器产物 `lib/client.js` 内嵌下列 npm 包，各包的版权与许可证全文见下。',
	'本包自身的代码使用 MIT 许可证，见 `LICENSE`。',
	'',
	...sections,
].join('\n')

fs.writeFileSync(NOTICES_FILE, `${notices.trimEnd()}\n`)
process.stderr.write(`build: wrote ${NOTICES_FILE} (${String(packages.size)} bundled packages)\n`)
