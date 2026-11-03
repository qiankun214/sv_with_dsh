/**
 * Smoke tests for the built browser bundle.
 *
 * They load `lib/client.js` exactly as the shell does — through
 * `window.__ModuleLoader__` — and then drive the plugin's two registrations with
 * stand-ins for React, the slot registry, and the right Sidebar. The point is to
 * catch wiring drift between the source, the bundle, and the shell contracts
 * without a browser.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ROUTE_PREFIX } from '../lib/http.js'
import { API_PREFIX } from '../src/client/transport.js'

/**
 * A React stand-in: `createElement` builds a plain tree, and the hooks the
 * registrations touch are inert. The panel's own hooks are exercised in the
 * browser, not here.
 * @returns the stand-in module.
 */
function fakeReact() {
	return {
		createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
		useState: (initial) => [initial, () => {}],
		useEffect: () => {},
		useRef: () => ({ current: undefined }),
		useCallback: (callback) => callback,
	}
}

/**
 * Install the document stand-in the plugin's stylesheet needs.
 */
function installDocument() {
	if (globalThis.document !== undefined) return
	const head = {
		children: [],
		appendChild(tag) {
			head.children.push(tag)
		},
	}
	globalThis.document = {
		head,
		createElement: () => ({ dataset: {}, textContent: '', id: '', remove() {} }),
		getElementById: (id) => head.children.find((tag) => tag.id === id) ?? null,
	}
}

/** The bundle's loader record, captured once: an ES module body runs once per process. */
let cachedRecord

/**
 * Read the record the bundle registered, importing it the first time.
 * @returns the loader record.
 */
async function loaderRecord() {
	if (cachedRecord !== undefined) return cachedRecord
	installDocument()
	globalThis.window = {
		__ModuleLoader__: {
			load: (registered) => {
				cachedRecord = registered
			},
		},
	}
	await import('../lib/client.js')
	assert.ok(cachedRecord, 'the bundle registers a loader record')
	return cachedRecord
}

/**
 * Materialize the plugin from the captured loader record.
 * @returns the plugin object and the React stand-in it was given.
 */
async function loadPlugin() {
	const record = await loaderRecord()
	const React = fakeReact()
	const plugin = record.factory((id) => {
		if (id === 'react') return React
		throw new Error(`unexpected module ${id}`)
	})
	return { record, plugin, React }
}

/**
 * A client Context stand-in that records what the plugin registers.
 * @returns the context plus the registration log.
 */
function fakeContext() {
	const log = { effects: [], injections: [], slots: [], tabs: [], opened: [], floated: [] }
	const ctx = {
		effect: (execute, label) => {
			log.effects.push(label)
			return execute()
		},
		logger: { warn() {} },
		locale: {
			register: () => () => {},
			bind: () => (key) => key,
			getLocale: () => ({ id: 'zh-CN' }),
		},
		slots: {
			inject: (key, callback) => {
				log.injections.push(key)
				return callback()
			},
			register: (options, component) => {
				log.slots.push({ options, component })
				return () => {}
			},
		},
		sidebarRight: {
			openTab: (kind, options) => log.opened.push({ kind, options }),
			active: () => ({ id: 'tab-1', kind: 'ask-discuss' }),
			float: (tabId) => log.floated.push(tabId),
		},
		sidebarRightTabs: {
			register: (definition) => {
				log.tabs.push(definition)
				return () => {}
			},
		},
	}
	return { ctx, log }
}

describe('bundle', () => {
	it('registers one loader record under the package id', async () => {
		const { record } = await loadPlugin()
		assert.equal(record.id, 'dsh-ask-discuss')
	})

	it('produces a plugin that injects the seats and services it uses', async () => {
		const { plugin } = await loadPlugin()
		assert.equal(plugin.name, 'dsh-ask-discuss')
		assert.deepEqual([...plugin.inject].sort(), ['locale', 'sidebarRight', 'sidebarRightTabs', 'slots'])
		assert.equal(typeof plugin.apply, 'function')
	})

	it('registers the tab type, its body, and the header entry', async () => {
		const { plugin } = await loadPlugin()
		const { ctx, log } = fakeContext()
		plugin.apply(ctx)

		assert.equal(log.tabs.length, 1)
		assert.deepEqual(
			{ id: log.tabs[0].id, kind: log.tabs[0].kind, priority: log.tabs[0].priority },
			{ id: 'dsh-ask-discuss', kind: 'ask-discuss', priority: 'extension' },
		)
		assert.equal(typeof log.tabs[0].title(), 'string')
		assert.equal(log.tabs[0].title(), '讨论')

		assert.deepEqual(log.injections.sort(), ['conversation.session.header.utilities', 'sidebar.right.pane.tab'])
		const entry = log.slots.find((slot) => slot.options.name === 'conversation.session.header.utilities')
		const body = log.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
		assert.ok(entry, 'the header entry is registered')
		assert.ok(body, 'the tab body is registered')
		assert.equal(entry.options.id, 'dsh-ask-discuss')
		assert.equal(body.options.key, 'dsh-ask-discuss', "the body is keyed by the type's own id")
		assert.equal(typeof entry.component, 'function')
		assert.equal(typeof body.component, 'function')
	})

	it('opens and floats the discussion tab on demand', async () => {
		const { plugin } = await loadPlugin()
		const { ctx, log } = fakeContext()
		plugin.apply(ctx)
		const entry = log.slots.find((slot) => slot.options.name === 'conversation.session.header.utilities')
		const tree = entry.component({
			sessionId: 'session-1',
			useSessionPendingInteraction: (selector) => selector(new Map([['session-1', { kind: 'question', key: 'k' }]])),
		})
		assert.equal(tree.type, 'button')
		assert.equal(tree.children[1].children[0], '讨论')
		tree.props.onClick()
		assert.deepEqual(log.opened[0], { kind: 'ask-discuss', options: { params: { sessionId: 'session-1' } } })
		assert.deepEqual(log.floated, ['tab-1'])
	})

	it('renders nothing when no interaction waits, or a non-question one does', async () => {
		const { plugin } = await loadPlugin()
		const { ctx, log } = fakeContext()
		plugin.apply(ctx)
		const entry = log.slots.find((slot) => slot.options.name === 'conversation.session.header.utilities')
		const empty = entry.component({ sessionId: 'session-1', useSessionPendingInteraction: (selector) => selector(new Map()) })
		assert.equal(empty, null)
		const approval = entry.component({
			sessionId: 'session-1',
			useSessionPendingInteraction: (selector) => selector(new Map([['session-1', { kind: 'approval', key: 'k' }]])),
		})
		assert.equal(approval, null)
	})
})

describe('transport/host contract', () => {
	it('agrees with the Host route prefix', () => {
		assert.equal(API_PREFIX, ROUTE_PREFIX)
	})
})
