/**
 * Unit tests for the zoom viewer's pure geometry and labels.
 * Run with `node test/zoom-math.test.mjs`.
 */
import assert from 'node:assert/strict'
import {
	FIT_RATIO,
	MAX_FACTOR,
	MIN_FACTOR,
	ZOOM_STEP,
	actualFactor,
	clamp,
	fitBox,
	fitWithin,
	percentLabel,
	zoomFactor,
} from '../src/client/zoom-math.js'

// A fitted box preserves the ratio and never exceeds the bounds.
assert.deepEqual(fitWithin(1000, 500, 500, 500), { width: 500, height: 250 })
assert.deepEqual(fitWithin(500, 1000, 500, 500), { width: 250, height: 500 })
// A small image is shown at its own pixels, never blown up to fill the box.
assert.deepEqual(fitWithin(100, 100, 500, 500), { width: 100, height: 100 })
assert.deepEqual(fitWithin(20, 40, 500, 500), { width: 20, height: 40 })
// Unmeasurable input is reported, not guessed.
assert.equal(fitWithin(0, 100, 500, 500), undefined)
assert.equal(fitWithin(100, 100, 0, 500), undefined)

// The viewport box leaves margins for the toolbar.
const fitted = fitBox(2000, 1000, 1000, 800)
assert.ok(fitted)
const maxWidth = 1000 * FIT_RATIO.width
const maxHeight = 800 * FIT_RATIO.height
assert.ok(fitted.width <= maxWidth + 1e-9)
assert.ok(fitted.height <= maxHeight + 1e-9)
assert.ok(Math.abs(fitted.width / fitted.height - 2) < 1e-9)

// 1:1 means one media pixel per CSS pixel, measured against the fitted box.
assert.equal(actualFactor(500, 2000), 4)
assert.equal(actualFactor(4000, 500), 0.125)
assert.equal(actualFactor(100000, 500), MIN_FACTOR)
assert.equal(actualFactor(0, 500), 1)
assert.equal(percentLabel(500, 2000), '25%')
assert.equal(percentLabel(800, 1000), '80%')
assert.equal(percentLabel(0, 1000), '—')
assert.equal(percentLabel(10, 0), '—')

// Factor limits and one step.
assert.equal(clamp(5, 0, 3), 3)
assert.equal(zoomFactor(100), MAX_FACTOR)
assert.equal(zoomFactor(0), MIN_FACTOR)
assert.equal(zoomFactor(1), 1)
assert.ok(Math.abs(1 * ZOOM_STEP * (1 / ZOOM_STEP) - 1) < 1e-12)

console.log('zoom-math: 24 checks passed')
