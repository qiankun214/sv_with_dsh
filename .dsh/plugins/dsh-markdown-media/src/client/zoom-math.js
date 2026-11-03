/**
 * Geometry and formatting for the zoom viewer.
 *
 * Kept separate from the DOM layer so the sizing rules can be tested without a
 * browser: the viewer always derives its canvas from the media's natural size,
 * the viewport, and one zoom factor whose 1.0 point is "fit".
 *
 * @module dsh-markdown-media/zoom-math
 */

/** Share of the viewport a fitted image may occupy. */
export const FIT_RATIO = { width: 0.9, height: 0.82 }
/** Zoom-factor limits, relative to the fitted size. */
export const MIN_FACTOR = 0.05
export const MAX_FACTOR = 16
/** One toolbar or keyboard zoom step. */
export const ZOOM_STEP = 1.25

/**
 * Clamp a number into an inclusive range.
 * @param value - the candidate value.
 * @param min - lower bound.
 * @param max - upper bound.
 * @returns the clamped value.
 */
export function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value))
}

/**
 * Scale one natural size into a bounding box, preserving its ratio.
 *
 * The result never exceeds the natural size: "fit" reveals a large image whole
 * and leaves a small one at its own pixels, the way a word processor's inline
 * picture behaves. Zooming past 100% is the viewer's explicit job, not the
 * opening state's.
 * @param width - natural width; a non-positive value is unmeasurable.
 * @param height - natural height.
 * @param maxWidth - available width.
 * @param maxHeight - available height.
 * @returns the fitted size, or `undefined` when any input is unusable.
 */
export function fitWithin(width, height, maxWidth, maxHeight) {
	if (!(width > 0) || !(height > 0) || !(maxWidth > 0) || !(maxHeight > 0)) return undefined
	const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
	return { width: width * ratio, height: height * ratio }
}

/**
 * The size one media element occupies when it is fitted to the viewport.
 * @param width - natural width.
 * @param height - natural height.
 * @param viewportWidth - window width.
 * @param viewportHeight - window height.
 * @returns the fitted size, or `undefined` when the media is unmeasurable.
 */
export function fitBox(width, height, viewportWidth, viewportHeight) {
	return fitWithin(
		width,
		height,
		viewportWidth * FIT_RATIO.width,
		viewportHeight * FIT_RATIO.height,
	)
}

/**
 * The zoom factor that shows one media pixel per CSS pixel.
 * @param fittedWidth - canvas width at factor 1.
 * @param naturalWidth - media width in natural pixels.
 * @returns the `actual size` factor, or 1 when it cannot be derived.
 */
export function actualFactor(fittedWidth, naturalWidth) {
	if (!(fittedWidth > 0) || !(naturalWidth > 0)) return 1
	return clamp(naturalWidth / fittedWidth, MIN_FACTOR, MAX_FACTOR)
}

/**
 * Render a zoom as a whole-number percentage of the media's natural size.
 * @param canvasWidth - current canvas width in CSS pixels.
 * @param naturalWidth - media width in natural pixels.
 * @returns the percentage label, e.g. `87%`.
 */
export function percentLabel(canvasWidth, naturalWidth) {
	if (!(naturalWidth > 0) || !(canvasWidth > 0)) return '—'
	return `${Math.round((canvasWidth / naturalWidth) * 100)}%`
}

/**
 * Clamp one zoom factor into the viewer's range.
 * @param factor - candidate factor.
 * @returns the clamped factor.
 */
export function zoomFactor(factor) {
	return clamp(factor, MIN_FACTOR, MAX_FACTOR)
}
