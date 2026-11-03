/**
 * dsh-ask-discuss — browser half.
 *
 * Adds one seat and one tab type, and nothing else:
 *
 * 1. A `/ 讨论` entry in the conversation header that exists only while an
 *    ordinary `ask_user_question` request waits for its answer. Visibility comes
 *    from the shell's own pending-interaction publication, so the entry is
 *    instant, reactive, and needs no polling.
 * 2. A right-Sidebar tab type that draws the discussion. Opening it through
 *    `ctx.sidebarRight.openTab` reveals the column, and `float` lifts the new tab
 *    out into a draggable floating panel — the shell's own dock kit owns the
 *    geometry, so this package ships no window management.
 *
 * The panel talks to the Host half over one prefix route. The bundle is loaded as
 * a classic script by `@deepseek-ai/dsh-client-modules`, so it registers its
 * factory on `window.__ModuleLoader__`; React and the primitive library come from
 * that loader's frozen module table.
 */

import { createEntry, readPendingInteraction } from './entry.js'
import { en, NS, zh } from './locales.js'
import { createPanel } from './panel.js'
import { insertStyles } from './styles.js'
import { createTransport } from './transport.js'

/** Package name: the loader id, the composition row name, and the tab type's id. */
const PLUGIN_ID = 'dsh-ask-discuss'
/** The tab type's discriminator; `openTab` names it. */
const TAB_KIND = 'ask-discuss'

window.__ModuleLoader__.load({
	id: PLUGIN_ID,
	factory: (require) => {
		const React = require('react')

		// The primitive library is supplied by the loader's frozen table. A shell
		// that does not carry it still gets a working panel, in plain text.
		let MarkdownText
		try {
			MarkdownText = require('@deepseek-ai/dsh-client-ui-primitives').MarkdownText
		} catch {
			MarkdownText = undefined
		}

		const transport = createTransport()

		/**
		 * Build this package's copy face over the shell's locale service.
		 * @param ctx - client root context.
		 * @returns `t` and the refusal-to-sentence mapper.
		 */
		function createCopy(ctx) {
			/**
			 * The dictionary matching the current locale.
			 * @returns the zh or en dictionary.
			 */
			function dictionary() {
				let id = ''
				try {
					id = String(ctx.locale.getLocale()?.id ?? '')
				} catch {
					id = ''
				}
				return id.toLowerCase().startsWith('zh') ? zh : en
			}

			let bound
			try {
				bound = ctx.locale.bind(NS)
			} catch {
				bound = undefined
			}

			/**
			 * Translate one key, falling back to this package's own dictionaries.
			 * @param key - the dictionary key.
			 * @returns the visible string.
			 */
			function t(key) {
				if (typeof bound === 'function') {
					try {
						const value = bound(key)
						if (typeof value === 'string' && value !== '' && value !== key) return value
					} catch {
						// Fall through to the built-in copy.
					}
				}
				const dict = dictionary()
				return dict[key] ?? en[key] ?? key
			}

			/**
			 * Render one Host refusal as a sentence.
			 * @param payload - the `{ok:false}` payload.
			 * @returns the visible sentence.
			 */
			function reason(payload) {
				const code = typeof payload?.reason === 'string' ? payload.reason : 'unknown'
				const key = `reason.${code}`
				const template = t(key)
				const resolved = template === key ? t('reason.unknown').replace('{reason}', code) : template
				const message = typeof payload?.message === 'string' ? payload.message : ''
				return resolved.replace('{message}', message)
			}

			return { t, reason }
		}

		/**
		 * Open the discussion tab, then lift it out into a floating panel.
		 * @param ctx - client root context.
		 * @param sessionId - the Session whose question waits.
		 */
		function openDiscussion(ctx, sessionId) {
			try {
				ctx.sidebarRight.openTab(TAB_KIND, { params: { sessionId } })
			} catch (error) {
				ctx.logger?.warn?.(`ask-discuss: cannot open the discussion tab: ${String(error?.message ?? error)}`)
				return
			}
			/**
			 * Float the tab that just became active, if the surface has committed it.
			 * @returns whether a float was issued.
			 */
			const float = () => {
				try {
					const active = ctx.sidebarRight.active()
					if (active === undefined || active === null) return false
					if (typeof active.kind === 'string' && active.kind !== TAB_KIND) return false
					ctx.sidebarRight.float(active.id)
					return true
				} catch (error) {
					ctx.logger?.warn?.(`ask-discuss: cannot float the discussion tab: ${String(error?.message ?? error)}`)
					return false
				}
			}
			// The store settles the open synchronously in the shipped seat; the retry
			// covers a first open that has to mount the column before it can navigate.
			if (!float()) setTimeout(float, 0)
		}

		/**
		 * Client plugin body.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => insertStyles(), 'ask-discuss: styles')
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ask-discuss: dictionaries')

			const copy = createCopy(ctx)
			const Entry = createEntry({
				React,
				copy,
				usePending: readPendingInteraction,
				open: (sessionId) => openDiscussion(ctx, sessionId),
			})
			const Panel = createPanel({ React, copy, transport, MarkdownText, usePending: readPendingInteraction })

			// Stage one: the tab type itself. A page type carries no address globs.
			ctx.effect(
				() =>
					ctx.sidebarRightTabs.register({
						id: PLUGIN_ID,
						kind: TAB_KIND,
						priority: 'extension',
						title: () => copy.t('tab.title'),
					}),
				'ask-discuss: tab type',
			)

			// Stage two: the body, keyed by the type's own id.
			ctx.slots.inject('sidebar.right.pane.tab', () =>
				ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PLUGIN_ID, locale: NS }, Panel),
			)

			ctx.slots.inject('conversation.session.header.utilities', () =>
				ctx.slots.register(
					{
						name: 'conversation.session.header.utilities',
						id: PLUGIN_ID,
						order: 40,
						locale: NS,
					},
					Entry,
				),
			)
		}

		return {
			name: PLUGIN_ID,
			inject: ['locale', 'slots', 'sidebarRight', 'sidebarRightTabs'],
			apply,
		}
	},
})
