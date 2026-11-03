/**
 * dsh-ask-discuss — the panel's stylesheet.
 *
 * One stylesheet owns every class this package draws. Colours are expressed with
 * `currentColor` and neutral alpha so the panel follows the shell's theme without
 * reading theme tokens, and the frame-wide surfaces the right Sidebar already
 * owns (tab chip, floating header, close control) are left untouched.
 */

/** Stable identifier for the injected stylesheet. */
export const STYLE_ID = 'dsh-ask-discuss/styles'

export const CSS = `
.dsad-entry {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 28px;
	padding: 0 10px;
	border: 1px solid rgba(127,127,127,0.35);
	border-radius: 8px;
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 12px;
	line-height: 1;
	cursor: pointer;
}

.dsad-entry:hover {
	background: rgba(127,127,127,0.14);
}

.dsad-entry-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #4c9aff;
}

.dsad-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	color: inherit;
	font: inherit;
}

.dsad-scroll {
	flex: 1 1 auto;
	min-height: 0;
	overflow: auto;
	padding: 12px 14px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.dsad-pack {
	border: 1px solid rgba(127,127,127,0.25);
	border-radius: 8px;
	padding: 8px 10px;
	background: rgba(127,127,127,0.06);
	font-size: 12px;
}

.dsad-pack summary {
	cursor: pointer;
	opacity: 0.75;
	user-select: none;
}

.dsad-pack pre {
	margin: 8px 0 0;
	white-space: pre-wrap;
	word-break: break-word;
	font-family: inherit;
	font-size: 12px;
	opacity: 0.85;
	max-height: 260px;
	overflow: auto;
}

.dsad-bubble {
	max-width: 100%;
	border-radius: 10px;
	padding: 8px 11px;
	font-size: 13px;
	line-height: 1.6;
	overflow-wrap: anywhere;
}

.dsad-user {
	align-self: flex-end;
	background: rgba(76,154,255,0.16);
	max-width: 86%;
}

.dsad-assistant {
	align-self: flex-start;
	background: rgba(127,127,127,0.10);
	max-width: 96%;
}

.dsad-tool {
	align-self: flex-start;
	max-width: 96%;
	font-size: 12px;
	opacity: 0.7;
	border-left: 2px solid rgba(127,127,127,0.35);
	padding-left: 8px;
}

.dsad-tool pre {
	margin: 4px 0 0;
	white-space: pre-wrap;
	word-break: break-word;
	font-family: inherit;
	max-height: 140px;
	overflow: auto;
}

.dsad-running {
	font-size: 12px;
	opacity: 0.6;
	padding-left: 2px;
}

.dsad-error {
	border: 1px solid rgba(220,90,90,0.55);
	background: rgba(220,90,90,0.10);
	color: inherit;
	border-radius: 8px;
	padding: 8px 10px;
	font-size: 12px;
	line-height: 1.5;
}

.dsad-hint {
	font-size: 12px;
	opacity: 0.6;
	padding: 4px 2px;
}

.dsad-compose {
	flex: 0 0 auto;
	border-top: 1px solid rgba(127,127,127,0.25);
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.dsad-input {
	width: 100%;
	box-sizing: border-box;
	min-height: 60px;
	max-height: 160px;
	resize: vertical;
	border-radius: 8px;
	border: 1px solid rgba(127,127,127,0.35);
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 13px;
	line-height: 1.5;
	padding: 8px 10px;
}

.dsad-input:focus {
	outline: none;
	border-color: rgba(76,154,255,0.7);
}

.dsad-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}

.dsad-send {
	height: 30px;
	padding: 0 16px;
	border-radius: 8px;
	border: 1px solid rgba(76,154,255,0.6);
	background: rgba(76,154,255,0.18);
	color: inherit;
	font: inherit;
	font-size: 13px;
	cursor: pointer;
}

.dsad-send:disabled {
	opacity: 0.45;
	cursor: default;
}
`

/**
 * Insert the stylesheet once, as the plugin's own effect.
 * @param doc - the document that owns the stylesheet.
 * @returns the disposer removing it.
 */
export function insertStyles(doc = document) {
	if (doc.getElementById(STYLE_ID) !== null) return () => {}
	const tag = doc.createElement('style')
	tag.id = STYLE_ID
	tag.dataset.plugin = 'dsh-ask-discuss'
	tag.textContent = CSS
	doc.head.appendChild(tag)
	return () => {
		tag.remove()
	}
}
