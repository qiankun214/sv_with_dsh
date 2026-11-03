/**
 * dsh-markdown-media — browser half.
 *
 * Adds the two things the shipped Markdown renderer leaves out:
 *
 * 1. Mermaid fences. The shipped renderer (`@deepseek-ai/dsh-client-ui-primitives`
 *    `MarkdownText`) has no diagram support, so a ```` ```mermaid ```` fence is
 *    shown as source. This half watches the document for Markdown code blocks
 *    whose text is a Mermaid document, renders them with the bundled Mermaid
 *    build, and keeps the source one click away. It works on every surface that
 *    uses `MarkdownText` (chat, Tool cards, the document preview) because it
 *    works on the rendered DOM instead of on one component.
 *
 * 2. Images in the right-Sidebar document preview. The shipped Markdown body
 *    passes no `pathImages` resolver, so every image degrades to its alt text.
 *    This half registers an `extension`-priority Markdown implementation whose
 *    body is the same `MarkdownText` with a resolver that maps both absolute
 *    paths and paths relative to the open document to the Host's authenticated
 *    `/api/file` route.
 *
 * The bundle is loaded as a classic script by `@deepseek-ai/dsh-client-modules`
 * and therefore registers itself through `window.__ModuleLoader__.load`. React
 * and the primitive library come from that loader's frozen module table.
 */
import mermaid from 'mermaid'
import { CLASS, MARK, STYLE_ATTR, STYLE_ID } from './classes.js'
import { createZoomLayer } from './lightbox.js'
import { documentAbsolutePath, mediaUrl } from './media-url.js'

/** Package name: the loader id, the boot-graph row name, and the action label. */
const PLUGIN_ID = 'dsh-markdown-media'
/** Document-preview implementation id (unique among live implementations). */
const IMPLEMENTATION_ID = `${PLUGIN_ID}/markdown`
/** This package's locale namespace. */
const LOCALE_NS = 'markdownMedia'

/** Diagram kinds Mermaid 11 accepts as the first statement of a fence. */
const MERMAID_KINDS = [
	'flowchart', 'graph',
	'sequenceDiagram',
	'classDiagram-v2', 'classDiagram',
	'stateDiagram-v2', 'stateDiagram',
	'erDiagram', 'journey', 'gantt', 'pie', 'quadrantChart',
	'requirementDiagram', 'gitGraph', 'mindmap', 'timeline', 'zenuml',
	'sankey-beta', 'xychart-beta', 'block-beta', 'packet-beta',
	'architecture-beta', 'kanban', 'radar-beta', 'treemap-beta',
	'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment',
	'info',
]
/** A fence opening: optional blank lines, optional `%%` directives, then a kind. */
const MERMAID_DOCUMENT = new RegExp(
	`^(?:(?:[ \\t]*(?:%%.*)?)\\r?\\n)*[ \\t]*(?:${MERMAID_KINDS.join('|')})(?![\\w-])`,
)
/** The most source text a fence may hold and still be considered for rendering. */
const MAX_DIAGRAM_SOURCE = 200_000

const zh = {
	'title': 'Markdown（图片 / 图表）',
	'code.copy': '复制',
	'code.copied': '已复制',
	'footnotes': '脚注',
	'mermaid.source': '查看源码',
	'mermaid.diagram': '查看图表',
	'zoom.dialog': '图片预览',
	'zoom.close': '关闭',
	'zoom.in': '放大',
	'zoom.out': '缩小',
	'zoom.fit': '适应窗口',
	'zoom.fitLabel': '适应',
	'zoom.actual': '实际大小',
	'zoom.actualLabel': '1:1',
	'zoom.actualHint': '切换到实际大小',
	'zoom.image': '图片',
}
const en = {
	'title': 'Markdown (images & diagrams)',
	'code.copy': 'Copy',
	'code.copied': 'Copied',
	'footnotes': 'Footnotes',
	'mermaid.source': 'Show source',
	'mermaid.diagram': 'Show diagram',
	'zoom.dialog': 'Image preview',
	'zoom.close': 'Close',
	'zoom.in': 'Zoom in',
	'zoom.out': 'Zoom out',
	'zoom.fit': 'Fit to window',
	'zoom.fitLabel': 'Fit',
	'zoom.actual': 'Actual size (1:1)',
	'zoom.actualLabel': '1:1',
	'zoom.actualHint': 'Switch to actual size',
	'zoom.image': 'Image',
}
/** Copy used when a locale service bound no dictionary for this namespace. */
const FALLBACK_COPY = en

const CSS = `
.${CLASS.document}{box-sizing:border-box;min-width:0;font-family:var(--dsw-font,inherit);white-space:normal;padding:10px 12px}
.${CLASS.diagram}{position:relative;display:flex;justify-content:center;margin:8px 0;padding:14px 12px;overflow:auto;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.${CLASS.diagramBody}{display:flex;justify-content:center;width:100%;overflow:auto}
.${CLASS.diagramBody} svg{max-width:100%;height:auto}
.${CLASS.diagramSource} .${CLASS.diagramBody}{display:none}
.${CLASS.diagramToggle}{position:absolute;top:4px;right:4px;font:inherit;font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:3px 7px;cursor:pointer;opacity:0;transition:opacity .12s ease}
.${CLASS.diagram}:hover .${CLASS.diagramToggle},.${CLASS.diagramToggle}:focus-visible{opacity:1}
/* Markdown media is click-to-enlarge, like an image in a word processor. */
[data-document-markdown] img,img[referrerpolicy][loading="lazy"][decoding="async"]{cursor:zoom-in}
[${MARK}="mermaid"]{cursor:zoom-in}
.${CLASS.zoom}{position:fixed;inset:0;z-index:1000;font:inherit}
.${CLASS.zoom}[hidden]{display:none}
.${CLASS.zoomBackdrop}{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.${CLASS.zoomStage}{position:absolute;inset:0;display:flex;overflow:auto;padding:28px 24px 92px;cursor:grab}
.${CLASS.zoomStage}:active{cursor:grabbing}
.${CLASS.zoomCanvas}{margin:auto;flex:none;position:relative}
.${CLASS.zoomCanvas} img{display:block;width:100%;height:100%;object-fit:contain;border-radius:8px;background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv3)}
.${CLASS.zoomCanvas} svg{display:block;width:100%;height:100%}
.${CLASS.zoomBar}{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:5px 6px;border-radius:999px;background:var(--dsw-specific-input-major);border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);box-shadow:var(--dsw-shadow-lv3);z-index:2}
.${CLASS.zoomBar} button{font:inherit;font-size:12px;line-height:1;color:var(--dsw-alias-label-primary);background:0 0;border:0;border-radius:999px;min-width:30px;height:30px;padding:0 9px;cursor:pointer;display:grid;place-items:center}
.${CLASS.zoomBar} button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.${CLASS.zoomBar} button:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill);outline-offset:1px}
.${CLASS.zoomBar} .${CLASS.zoomScale}{min-width:52px;font-variant-numeric:tabular-nums}
.${CLASS.zoomCaption}{position:fixed;left:50%;bottom:66px;transform:translateX(-50%);max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:12px;z-index:2}
.${CLASS.zoomCaption}[hidden]{display:none}
`

/**
 * Install this package's stylesheet.
 * @returns the disposer that removes the style element.
 */
function insertStyles() {
	const style = document.createElement('style')
	style.dataset.plugin = PLUGIN_ID
	style.setAttribute(STYLE_ATTR, STYLE_ID)
	style.textContent = CSS
	document.head.appendChild(style)
	return () => {
		style.remove()
	}
}

/**
 * Whether one code block holds a Mermaid document.
 * @param text - the code block's text.
 * @returns `true` when the first statement names a Mermaid diagram kind.
 */
function looksLikeDiagram(text) {
	if (typeof text !== 'string' || text === '' || text.length > MAX_DIAGRAM_SOURCE) return false
	return MERMAID_DOCUMENT.test(text.replace(/^\uFEFF/, ''))
}

/**
 * Build the DOM half: a Mermaid renderer over rendered Markdown code blocks.
 * @param options - theme probe, copy, and the Mermaid module.
 * @returns the start/dispose pair plus a full rescan.
 */
function createDiagramLayer({ getDark, copy }) {
	/** pre element -> { text, token, wrapper, showSource }. */
	let records = new Map()
	let sequence = 0
	let pending = new Set()
	let scheduled = 0
	let initialized = false
	let initializedDark = false
	let observer
	let themeObserver
	let currentDark = false

	/**
	 * Probe the application's brightness, preferring the theme service snapshot.
	 * @returns `true` when the page is in a dark theme.
	 */
	function isDark() {
		try {
			const fromTheme = getDark()
			if (typeof fromTheme === 'boolean') return fromTheme
		} catch {
			// A theme probe is advisory; fall back to computed colours.
		}
		const root = document.documentElement
		const declared = `${root.getAttribute('data-theme') ?? ''} ${root.className ?? ''}`
		if (/dark/i.test(declared)) return true
		if (/light/i.test(declared)) return false
		const background = getComputedStyle(document.body ?? root).backgroundColor
		const channels = /^rgba?\(([^)]+)\)/.exec(background)
		if (channels === null) return false
		const [r = 255, g = 255, b = 255] = channels[1].split(',').map((part) => Number.parseFloat(part))
		return r * 0.299 + g * 0.587 + b * 0.114 < 128
	}

	/**
	 * Configure Mermaid for the current page brightness.
	 * @param dark - whether the page is dark.
	 */
	function configure(dark) {
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'strict',
			suppressErrorRendering: true,
			theme: dark ? 'dark' : 'default',
			fontFamily: 'var(--dsw-font, inherit)',
			flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
			sequence: { useMaxWidth: true },
			gantt: { useMaxWidth: true },
		})
		initialized = true
		initializedDark = dark
	}

	/**
	 * Redraw one diagram's toggle caption.
	 * @param record - the code block's render record.
	 */
	function paintToggle(record) {
		if (!record.wrapper) return
		const button = record.wrapper.querySelector(`.${CLASS.diagramToggle}`)
		if (button === null) return
		button.textContent = record.showSource ? copy.diagram : copy.source
		button.setAttribute('aria-pressed', record.showSource ? 'true' : 'false')
	}

	/**
	 * Show either the diagram or its source.
	 * @param record - the code block's render record.
	 * @param showSource - `true` reveals the code block and hides the drawing.
	 */
	function setShowSource(record, showSource) {
		record.showSource = showSource
		if (record.wrapper) record.wrapper.classList.toggle(CLASS.diagramSource, showSource)
		if (record.pre) {
			if (showSource) record.pre.style.removeProperty('display')
			else record.pre.style.setProperty('display', 'none', 'important')
		}
		paintToggle(record)
	}

	/**
	 * Forget one block: remove its drawing and restore its source.
	 * @param pre - the code block's `pre`.
	 * @param record - its render record.
	 */
	function teardown(pre, record) {
		if (record.wrapper) record.wrapper.remove()
		record.wrapper = undefined
		record.text = ''
		pre.style.removeProperty('display')
	}

	/**
	 * Put a rendered SVG into the block's drawing container.
	 * @param pre - the code block's `pre`.
	 * @param record - its render record.
	 * @param svg - the rendered SVG markup.
	 */
	function paint(pre, record, svg) {
		record.pre = pre
		let wrapper = record.wrapper
		if (wrapper === undefined || !wrapper.isConnected) {
			wrapper = document.createElement('div')
			wrapper.className = CLASS.diagram
			wrapper.setAttribute(MARK, 'mermaid')
			const body = document.createElement('div')
			body.className = CLASS.diagramBody
			const button = document.createElement('button')
			button.type = 'button'
			button.className = CLASS.diagramToggle
			button.addEventListener('click', () => setShowSource(record, record.showSource !== true))
			wrapper.append(body, button)
			pre.after(wrapper)
			record.wrapper = wrapper
			record.showSource = false
		}
		const body = wrapper.querySelector(`.${CLASS.diagramBody}`)
		if (body !== null) body.innerHTML = svg
		setShowSource(record, record.showSource === true)
	}

	/**
	 * Render one candidate code block, if it changed since the last attempt.
	 * @param pre - a `pre` element.
	 */
	async function processPre(pre) {
		if (!(pre instanceof Element) || !pre.isConnected) return
		if (pre.closest('[contenteditable="true"],[contenteditable=""]')) return
		const code = pre.querySelector('code')
		if (code === null) return
		const text = code.textContent ?? ''
		let record = records.get(pre)
		if (record === undefined) {
			record = { text: '', token: 0, wrapper: undefined, showSource: false, pre }
			records.set(pre, record)
		}
		if (record.text === text) return
		record.text = text
		const token = (record.token += 1)
		if (!looksLikeDiagram(text)) {
			if (record.wrapper !== undefined) teardown(pre, record)
			return
		}
		const dark = isDark()
		currentDark = dark
		if (!initialized || initializedDark !== dark) configure(dark)
		let svg
		try {
			await mermaid.parse(text)
			const result = await mermaid.render(`md-media-${(sequence += 1)}`, text)
			svg = result?.svg
		} catch (error) {
			// An invalid or still-streaming diagram stays a code block.
			if (record.warned !== text) {
				record.warned = text
				console.warn(`[${PLUGIN_ID}] ${String(error?.message ?? error)}`)
			}
			return
		}
		if (typeof svg !== 'string' || svg === '') return
		if (!pre.isConnected || record.token !== token) return
		paint(pre, record, svg)
	}

	/** Queue candidate nodes for the next pass. */
	function schedule(nodes) {
		for (const node of nodes) pending.add(node)
		if (scheduled !== 0) return
		scheduled = window.setTimeout(flush, 120)
	}

	/** Drop drawings whose code block left the document. */
	function cleanupOrphans() {
		for (const [pre, record] of records) {
			if (pre.isConnected) continue
			if (record.wrapper) record.wrapper.remove()
			records.delete(pre)
		}
		for (const wrapper of document.querySelectorAll(`[${MARK}="mermaid"]`)) {
			const previous = wrapper.previousElementSibling
			if (previous === null || previous.tagName !== 'PRE') wrapper.remove()
		}
	}

	/** Process everything queued since the last pass. */
	function flush() {
		scheduled = 0
		const targets = [...pending]
		pending = new Set()
		for (const node of targets) {
			if (!(node instanceof Node) || !node.isConnected) continue
			if (node.nodeType === Node.TEXT_NODE) {
				const pre = node.parentElement?.closest('pre')
				if (pre) void processPre(pre)
				continue
			}
			if (!(node instanceof Element)) continue
			if (node.tagName === 'PRE') {
				void processPre(node)
				continue
			}
			for (const pre of node.querySelectorAll('pre')) void processPre(pre)
		}
		cleanupOrphans()
	}

	/** Scan every code block currently in the document. */
	function rescan() {
		for (const pre of document.querySelectorAll('pre')) void processPre(pre)
	}

	/** Rebuild every drawing after a brightness change. */
	function rerender() {
		for (const record of records.values()) {
			if (record.wrapper) record.wrapper.remove()
			record.wrapper = undefined
			record.text = ''
		}
		initialized = false
		rescan()
	}

	/** Start observing the page; returns the disposer. */
	function start() {
		if (typeof document === 'undefined') return () => {}
		currentDark = isDark()
		observer = new MutationObserver((mutations) => {
			const batch = []
			for (const mutation of mutations) {
				if (mutation.type === 'characterData') batch.push(mutation.target)
				for (const node of mutation.addedNodes) batch.push(node)
			}
			if (batch.length > 0) schedule(batch)
		})
		observer.observe(document.body, { childList: true, subtree: true, characterData: true })
		themeObserver = new MutationObserver(() => {
			const dark = isDark()
			if (dark === currentDark) return
			currentDark = dark
			rerender()
		})
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'style', 'data-theme'],
		})
		schedule([document.body])
		return () => {
			observer?.disconnect()
			themeObserver?.disconnect()
			if (scheduled !== 0) window.clearTimeout(scheduled)
			scheduled = 0
			pending.clear()
			for (const [pre, record] of records) {
				if (record.wrapper) record.wrapper.remove()
				pre.style.removeProperty('display')
			}
			records = new Map()
		}
	}

	return { start, rescan }
}

window.__ModuleLoader__.load({
	id: PLUGIN_ID,
	factory: (require) => {
		const React = require('react')
		const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
		const { MarkdownText } = primitives
		const h = React.createElement

		/**
		 * Run one copy lookup, falling back to this package's English defaults.
		 * @param translate - a locale-bound translate function, when the framework supplied one.
		 * @param key - the dictionary key.
		 * @returns the visible string.
		 */
		function copyOf(translate, key) {
			if (typeof translate === 'function') {
				try {
					const value = translate(key)
					if (typeof value === 'string' && value !== '') return value
				} catch {
					// Fall through to the built-in copy.
				}
			}
			return FALLBACK_COPY[key] ?? key
		}

		/**
		 * The document-preview Markdown implementation: the shipped primitive plus
		 * an image resolver that understands paths relative to the open document.
		 * @param props - the document slot's owner props and standard hooks.
		 * @returns the rendered Markdown, or nothing for a non-text delivery.
		 */
		function MarkdownMediaBody(props) {
			const { content, resourceAddress, useResource, t } = props
			const snapshot = typeof useResource === 'function' ? useResource(resourceAddress) : undefined
			const absolutePath = documentAbsolutePath(resourceAddress, snapshot)
			const pathImages = React.useMemo(
				() => ({ resolve: (value) => mediaUrl(absolutePath, value) }),
				[absolutePath],
			)
			const labels = React.useMemo(() => ({
				code: {
					copyLabel: copyOf(t, 'code.copy'),
					copiedLabel: copyOf(t, 'code.copied'),
				},
				footnotes: copyOf(t, 'footnotes'),
			}), [t])
			if (content === undefined || content === null || content.kind !== 'text') return null
			return h(
				'div',
				{ className: CLASS.document, 'data-document-markdown': true },
				h(MarkdownText, {
					text: content.text,
					streaming: !content.eof,
					labels,
					pathImages,
				}),
			)
		}

		/** Register the preview implementation, the diagram layer, and the dictionaries. */
		function apply(ctx) {
			ctx.effect(() => insertStyles(), 'markdown-media: styles')
			ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'markdown-media: dictionaries')
			const t = ctx.locale.bind(LOCALE_NS)
			const copy = {
				source: copyOf(t, 'mermaid.source'),
				diagram: copyOf(t, 'mermaid.diagram'),
				dialog: copyOf(t, 'zoom.dialog'),
				close: copyOf(t, 'zoom.close'),
				zoomIn: copyOf(t, 'zoom.in'),
				zoomOut: copyOf(t, 'zoom.out'),
				fit: copyOf(t, 'zoom.fit'),
				fitLabel: copyOf(t, 'zoom.fitLabel'),
				actual: copyOf(t, 'zoom.actual'),
				actualLabel: copyOf(t, 'zoom.actualLabel'),
				actualHint: copyOf(t, 'zoom.actualHint'),
				image: copyOf(t, 'zoom.image'),
			}
			const diagrams = createDiagramLayer({
				copy,
				getDark: () => {
					const theme = ctx.get('theme')
					if (theme === undefined || typeof theme.getTheme !== 'function') return undefined
					const snapshot = theme.getTheme()
					const id = typeof snapshot === 'string' ? snapshot : snapshot?.id
					if (typeof id !== 'string' || id === '') return undefined
					return /dark/i.test(id) ? true : /light/i.test(id) ? false : undefined
				},
			})
			ctx.effect(() => ctx.documentPreviews.register({
				id: IMPLEMENTATION_ID,
				extensions: ['md', 'markdown'],
				priority: 'extension',
				title: () => copyOf(t, 'title'),
				loading: 'text-pages',
				wrap: false,
			}), 'markdown-media: document definition')
			ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
				name: 'sidebar.right.tab.document',
				key: IMPLEMENTATION_ID,
				locale: LOCALE_NS,
			}, MarkdownMediaBody)), 'markdown-media: document body')
			ctx.effect(() => diagrams.start(), 'markdown-media: diagram layer')
			const zoom = createZoomLayer({ copy })
			ctx.effect(() => zoom.start(), 'markdown-media: zoom layer')
		}

		return {
			name: PLUGIN_ID,
			inject: ['locale', 'documentPreviews', 'slots'],
			apply,
		}
	},
})
