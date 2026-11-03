/**
 * Build the browser bundle for dsh-ask-discuss.
 *
 * The output is one classic script that registers the package's plugin factory
 * with `window.__ModuleLoader__`, which is the only shape
 * `@deepseek-ai/dsh-client-modules` loads. React and the primitive library are
 * never bundled: the loader's frozen table supplies both, so the bundle stays a
 * few kilobytes and cannot ship a second copy of React.
 *
 * Usage: pnpm install && node build.mjs
 */
import { build } from 'esbuild'

await build({
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
	banner: { js: '/* dsh-ask-discuss: browser bundle, built by build.mjs */' },
	logLevel: 'info',
})
