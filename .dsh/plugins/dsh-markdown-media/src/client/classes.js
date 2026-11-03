/**
 * The element classes and marker attribute this package owns across its DOM
 * layers (document body, Mermaid blocks, zoom viewer). Kept in one module so
 * the stylesheet and the code that creates those elements cannot drift.
 *
 * @module dsh-markdown-media/classes
 */

/** Marker attribute carried by every element this package creates. */
export const MARK = 'data-markdown-media'

/** Style element identity, so a re-load replaces rather than duplicates it. */
export const STYLE_ATTR = 'data-plugin-css'
export const STYLE_ID = 'dsh-markdown-media/styles'

/** Class names. */
export const CLASS = {
	/** The document-preview body wrapper. */
	document: 'md-media-document',
	/** One rendered Mermaid block. */
	diagram: 'md-media-mermaid',
	diagramBody: 'md-media-mermaid-body',
	diagramSource: 'md-media-mermaid-source',
	diagramToggle: 'md-media-mermaid-toggle',
	/** The zoom viewer. */
	zoom: 'md-media-zoom',
	zoomBackdrop: 'md-media-zoom-backdrop',
	zoomStage: 'md-media-zoom-stage',
	zoomCanvas: 'md-media-zoom-canvas',
	zoomBar: 'md-media-zoom-bar',
	zoomScale: 'md-media-zoom-scale',
	zoomCaption: 'md-media-zoom-caption',
}
