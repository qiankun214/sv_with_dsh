/**
 * Click-to-enlarge viewer for rendered Markdown media.
 *
 * One delegated click listener covers every surface: an image inside a
 * document-preview body, a chat message's Markdown image, or a rendered Mermaid
 * diagram opens a full-window viewer with fit/actual-size/zoom controls, wheel
 * zoom, drag panning, double-click toggle, and Escape/backdrop close.
 *
 * It is a plain-DOM overlay appended to `document.body`, outside React's tree,
 * so re-renders (streaming messages, paged documents) cannot fight it.
 *
 * @module dsh-markdown-media/lightbox
 */
import { CLASS, MARK } from './classes.js'
import {
	ZOOM_STEP,
	actualFactor,
	fitBox,
	percentLabel,
	zoomFactor,
} from './zoom-math.js'

/** Marker value the diagram layer writes on its wrappers. */
const DIAGRAM_MARK = 'mermaid'

/**
 * Whether one `img` is a Markdown image this viewer may enlarge.
 *
 * Two signals: it lives inside a Markdown body (`data-document-markdown`, which
 * both this package's preview and the shipped one emit), or it carries the
 * shipped primitive's exact image attributes — the only element in the
 * application that sets all three.
 *
 * @param image - the candidate image.
 * @returns `true` for a Markdown image.
 */
function isMarkdownImage(image) {
	if (image.closest('[data-document-markdown]') !== null) return true
	return image.hasAttribute('referrerpolicy')
		&& image.getAttribute('loading') === 'lazy'
		&& image.getAttribute('decoding') === 'async'
}

/**
 * Resolve the media one click landed on.
 * @param target - the click target.
 * @param copy - resolved viewer copy.
 * @returns the entry to open, or `undefined` when the click is none of our business.
 */
function describeTarget(target, copy) {
	if (!(target instanceof Element)) return undefined
	if (target.closest(`[${MARK}="zoom"]`) !== null) return undefined
	if (target.closest('a') !== null) return undefined
	const diagram = target.closest(`[${MARK}="${DIAGRAM_MARK}"]`)
	if (diagram !== null) {
		// The source toggle stays a toggle.
		if (target.closest('button') !== null) return undefined
		const svg = diagram.querySelector('svg')
		return svg === null ? undefined : { kind: 'svg', node: svg, caption: copy.diagram }
	}
	const image = target.closest('img')
	if (image === null || !isMarkdownImage(image)) return undefined
	const source = image.currentSrc || image.getAttribute('src') || ''
	if (source === '') return undefined
	return { kind: 'image', node: image, source, caption: image.getAttribute('alt') || copy.image }
}

/**
 * The natural size of one media element.
 * @param entry - the described click target.
 * @returns usable pixel dimensions, falling back to the rendered box.
 */
function naturalSizeOf(entry) {
	if (entry.kind === 'svg') {
		const box = entry.node.getBoundingClientRect()
		const viewBox = entry.node.viewBox?.baseVal
		const width = viewBox !== undefined && viewBox.width > 0 ? viewBox.width : box.width
		const height = viewBox !== undefined && viewBox.height > 0 ? viewBox.height : box.height
		return { width: width > 0 ? width : 960, height: height > 0 ? height : 640 }
	}
	const { naturalWidth, naturalHeight, width, height } = entry.node
	if (naturalWidth > 0 && naturalHeight > 0) return { width: naturalWidth, height: naturalHeight }
	const box = entry.node.getBoundingClientRect()
	return {
		width: width > 0 ? width : box.width > 0 ? box.width : 960,
		height: height > 0 ? height : box.height > 0 ? box.height : 640,
	}
}

/**
 * Build the zoom viewer.
 * @param options.copy - resolved viewer labels.
 * @returns the start/dispose pair; both are idempotent.
 */
export function createZoomLayer({ copy }) {
	let root
	let backdrop
	let stage
	let canvas
	let bar
	let caption
	let scaleButton
	let closeButton
	let media
	let session
	let returnFocus
	let previousBodyOverflow
	let pointer
	let suppressClick = false

	/**
	 * Whether the viewer is showing.
	 * @returns `true` while open.
	 */
	function isOpen() {
		return root !== undefined && root.isConnected && root.hidden !== true
	}

	/**
	 * Size the canvas for one zoom factor, optionally keeping a point steady.
	 * @param factor - requested factor; 1 fits the viewport.
	 * @param anchor - viewport-relative point to keep under the cursor.
	 */
	function applyFactor(factor, anchor) {
		if (session === undefined) return
		const next = zoomFactor(factor)
		const previousWidth = canvas.offsetWidth > 0 ? canvas.offsetWidth : session.base.width
		const previousHeight = canvas.offsetHeight > 0 ? canvas.offsetHeight : session.base.height
		session.factor = next
		const width = Math.max(1, Math.round(session.base.width * next))
		const height = Math.max(1, Math.round(session.base.height * next))
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`
		if (scaleButton !== null) {
			scaleButton.textContent = percentLabel(width, session.natural.width)
			scaleButton.title = copy.actualHint
		}
		if (anchor !== undefined) {
			const stageBox = stage.getBoundingClientRect()
			const ratioX = (stage.scrollLeft + (anchor.x - stageBox.left)) / previousWidth
			const ratioY = (stage.scrollTop + (anchor.y - stageBox.top)) / previousHeight
			stage.scrollLeft = Math.max(0, ratioX * width - (anchor.x - stageBox.left))
			stage.scrollTop = Math.max(0, ratioY * height - (anchor.y - stageBox.top))
		}
	}

	/** Fit the media to the window. */
	function fit() {
		applyFactor(1)
	}

	/** Show one media pixel per CSS pixel. */
	function actualSize() {
		if (session === undefined) return
		applyFactor(actualFactor(session.base.width, session.natural.width))
	}

	/** Recompute the fitted box after a window resize. */
	function refit() {
		if (session === undefined) return
		const box = fitBox(session.natural.width, session.natural.height, window.innerWidth, window.innerHeight)
		if (box === undefined) return
		const wasFit = Math.abs(session.factor - 1) < 0.001
		session.base = box
		applyFactor(wasFit ? 1 : session.factor)
	}

	/**
	 * Build one toolbar button.
	 * @param action - the click handler.
	 * @param label - accessible name and tooltip.
	 * @param text - visible text.
	 * @param className - optional extra class.
	 * @returns the button.
	 */
	function button(action, label, text, className) {
		const element = document.createElement('button')
		element.type = 'button'
		element.textContent = text
		element.setAttribute('aria-label', label)
		element.title = label
		if (className !== undefined) element.className = className
		element.addEventListener('click', () => {
			action()
		})
		return element
	}

	/** Create the overlay once, on first use. */
	function build() {
		root = document.createElement('div')
		root.className = CLASS.zoom
		root.hidden = true
		root.setAttribute(MARK, 'zoom')
		root.setAttribute('role', 'dialog')
		root.setAttribute('aria-modal', 'true')
		root.setAttribute('aria-label', copy.dialog)

		backdrop = document.createElement('div')
		backdrop.className = CLASS.zoomBackdrop
		backdrop.addEventListener('click', () => {
			close()
		})

		stage = document.createElement('div')
		stage.className = CLASS.zoomStage
		canvas = document.createElement('div')
		canvas.className = CLASS.zoomCanvas
		stage.append(canvas)
		stage.addEventListener('wheel', onWheel, { passive: false })
		stage.addEventListener('pointerdown', onPointerDown)
		stage.addEventListener('pointermove', onPointerMove)
		stage.addEventListener('pointerup', onPointerUp)
		stage.addEventListener('pointercancel', onPointerUp)
		stage.addEventListener('dblclick', onDoubleClick)
		stage.addEventListener('click', (event) => {
			if (event.target !== stage) return
			if (suppressClick) {
				suppressClick = false
				return
			}
			close()
		})

		bar = document.createElement('div')
		bar.className = CLASS.zoomBar
		bar.append(
			button(() => applyFactor(currentFactor() / ZOOM_STEP), copy.zoomOut, '−'),
			scaleButton = button(actualSize, copy.actualHint, '100%', CLASS.zoomScale),
			button(() => applyFactor(currentFactor() * ZOOM_STEP), copy.zoomIn, '+'),
			button(fit, copy.fit, copy.fitLabel),
			button(actualSize, copy.actual, copy.actualLabel),
			button(() => close(), copy.close, '×'),
		)
		closeButton = bar.lastElementChild

		caption = document.createElement('div')
		caption.className = CLASS.zoomCaption

		root.append(backdrop, stage, bar, caption)
		document.body.append(root)
	}

	/**
	 * The factor currently in force.
	 * @returns the factor, or 1 when nothing is open.
	 */
	function currentFactor() {
		return session === undefined ? 1 : session.factor
	}

	/**
	 * Show one media entry in the viewer.
	 * @param entry - the described click target.
	 * @param opener - the element to restore focus to on close.
	 */
	function open(entry, opener) {
		if (typeof document === 'undefined') return
		if (root === undefined || !root.isConnected) build()
		returnFocus = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined)
		const natural = naturalSizeOf(entry)
		const base = fitBox(natural.width, natural.height, window.innerWidth, window.innerHeight)
			?? { width: natural.width, height: natural.height }
		session = { natural, base, factor: 1 }
		canvas.replaceChildren()
		media = entry.kind === 'svg' ? entry.node.cloneNode(true) : document.createElement('img')
		if (entry.kind === 'svg') {
			// The drawing fills the canvas, so its own pixel attributes must go.
			media.removeAttribute('style')
			media.removeAttribute('width')
			media.removeAttribute('height')
		} else {
			media.src = entry.source
			media.alt = entry.caption
			media.draggable = false
			media.addEventListener('load', () => {
				if (session === undefined) return
				if (natural.width > 0 && natural.height > 0) return
				session.natural = { width: media.naturalWidth, height: media.naturalHeight }
				const box = fitBox(session.natural.width, session.natural.height, window.innerWidth, window.innerHeight)
				if (box !== undefined) session.base = box
				applyFactor(1)
			})
		}
		canvas.append(media)
		caption.textContent = entry.caption
		caption.hidden = entry.caption === ''
		applyFactor(1)
		root.hidden = false
		previousBodyOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		stage.scrollTop = 0
		stage.scrollLeft = 0
		closeButton?.focus({ preventScroll: true })
	}

	/** Hide the viewer and restore the page. */
	function close() {
		if (root === undefined || root.hidden === true) return
		root.hidden = true
		canvas?.replaceChildren()
		media = undefined
		session = undefined
		caption.textContent = ''
		if (previousBodyOverflow !== undefined) {
			document.body.style.overflow = previousBodyOverflow
			previousBodyOverflow = undefined
		}
		returnFocus?.focus?.({ preventScroll: true })
		returnFocus = undefined
	}

	/**
	 * Zoom around the pointer.
	 * @param event - the wheel event.
	 */
	function onWheel(event) {
		if (!isOpen() || session === undefined) return
		event.preventDefault()
		const step = Math.exp(-event.deltaY * 0.0015)
		applyFactor(session.factor * step, { x: event.clientX, y: event.clientY })
	}

	/**
	 * Whether the stage currently has something to pan.
	 * @returns `true` when the canvas overflows the stage.
	 */
	function canPan() {
		return stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight
	}

	/**
	 * Start drag-to-pan.
	 * @param event - the pointer event.
	 */
	function onPointerDown(event) {
		if (!isOpen() || event.button !== 0 || !canPan()) return
		pointer = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			left: stage.scrollLeft,
			top: stage.scrollTop,
			moved: false,
		}
		stage.setPointerCapture?.(event.pointerId)
	}

	/**
	 * Pan with the pointer.
	 * @param event - the pointer event.
	 */
	function onPointerMove(event) {
		if (pointer === undefined || pointer.id !== event.pointerId) return
		const dx = event.clientX - pointer.x
		const dy = event.clientY - pointer.y
		if (!pointer.moved && Math.abs(dx) + Math.abs(dy) < 4) return
		pointer.moved = true
		stage.scrollLeft = pointer.left - dx
		stage.scrollTop = pointer.top - dy
	}

	/**
	 * End a pan, suppressing the click it would otherwise become.
	 * @param event - the pointer event.
	 */
	function onPointerUp(event) {
		if (pointer === undefined || pointer.id !== event.pointerId) return
		if (pointer.moved) suppressClick = true
		stage.releasePointerCapture?.(event.pointerId)
		pointer = undefined
	}

	/**
	 * Toggle fit and actual size on a double click.
	 * @param event - the double-click event.
	 */
	function onDoubleClick(event) {
		if (!isOpen() || event.target === stage) return
		if (currentFactor() >= actualFactor(session?.base.width ?? 0, session?.natural.width ?? 0) - 0.001) fit()
		else actualSize()
	}

	/**
	 * Keyboard handling: close, zoom, fit, actual size.
	 * @param event - the key event.
	 */
	function onKeyDown(event) {
		if (!isOpen()) return
		switch (event.key) {
			case 'Escape':
				event.preventDefault()
				close()
				break
			case '+':
			case '=':
				event.preventDefault()
				applyFactor(currentFactor() * ZOOM_STEP)
				break
			case '-':
			case '_':
				event.preventDefault()
				applyFactor(currentFactor() / ZOOM_STEP)
				break
			case '0':
				event.preventDefault()
				fit()
				break
			case '1':
				event.preventDefault()
				actualSize()
				break
			default:
				break
		}
	}

	/**
	 * One delegated document click: open the viewer for Markdown media.
	 * @param event - the click event.
	 */
	function onClick(event) {
		if (event.defaultPrevented || event.button !== 0) return
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
		const entry = describeTarget(event.target, copy)
		if (entry === undefined) return
		event.preventDefault()
		open(entry, entry.kind === 'image' ? entry.node : undefined)
	}

	/**
	 * Install the listeners.
	 * @returns the disposer.
	 */
	function start() {
		if (typeof document === 'undefined') return () => {}
		document.addEventListener('click', onClick)
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('resize', refit)
		return () => {
			document.removeEventListener('click', onClick)
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('resize', refit)
			close()
			root?.remove()
			root = undefined
			bar = undefined
			caption = undefined
			canvas = undefined
			stage = undefined
			backdrop = undefined
			media = undefined
			session = undefined
			scaleButton = undefined
			closeButton = undefined
			pointer = undefined
			suppressClick = false
		}
	}

	return { start, close }
}
