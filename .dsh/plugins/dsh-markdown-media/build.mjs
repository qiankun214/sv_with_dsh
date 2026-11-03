/**
 * Build the browser bundle for dsh-markdown-media.
 *
 * The output is one classic script that registers the package's plugin factory
 * with `window.__ModuleLoader__.load`, which is the only shape
 * `@deepseek-ai/dsh-client-modules` loads. React and the primitive library stay
 * external — the loader's frozen table supplies both, so they are never bundled
 * twice.
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
	banner: { js: '/* dsh-markdown-media: browser bundle, built by build.mjs */' },
	logLevel: 'info',
})
