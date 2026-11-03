/**
 * Host file URLs for Markdown media destinations.
 *
 * The shipped Markdown primitive renders an image only when the destination is
 * an http(s)/data/blob URL, or when the caller's `pathImages` resolver turns it
 * into one. The right-Sidebar document preview supplies no resolver, and a
 * relative destination has no meaning without the open document's directory, so
 * this module owns both: the preview renderer holds the document path and asks
 * this module for the URL of every authored destination.
 *
 * @module dsh-markdown-media/media-url
 */

/**
 * Resolve one authored media destination to a Host-served URL.
 * @param absoluteDocumentPath - absolute path of the open Markdown document, when known.
 * @param value - the destination exactly as authored.
 * @returns the same-origin `/api/file` URL, or `undefined` when the destination cannot be a Host-served file.
 */
export function mediaUrl(absoluteDocumentPath, value) {
	if (typeof value !== 'string') return undefined
	let destination = value.trim()
	if (destination === '') return undefined
	// Remote and inline schemes reach the browser as authored.
	if (/^(?:https?:|data:|blob:)/i.test(destination)) return destination
	if (destination.startsWith('//')) return undefined
	// A fragment or query belongs to the page, not to the file path.
	destination = destination.split('#')[0].split('?')[0]
	if (destination === '') return undefined
	if (/^file:\/\//i.test(destination)) {
		destination = decodePath(destination.replace(/^file:\/\/(?:localhost)?/i, ''))
	}
	destination = decodePath(destination)
	const absolute = destination.startsWith('/')
		? normalizePath(destination)
		: joinPath(documentDirectory(absoluteDocumentPath), destination)
	return absolute === undefined || absolute === '' ? undefined : fileUrl(absolute)
}

/**
 * Turn an absolute POSIX path into the authenticated route that serves it.
 * @param absolutePath - absolute path on the Host.
 * @returns the origin-relative URL.
 */
export function fileUrl(absolutePath) {
	const origin = window.location.origin
	return `${origin}/api/file?path=${encodeURIComponent(absolutePath)}`
}

/**
 * Decode one authored path without failing on a literal percent sign.
 * @param value - possibly percent-encoded path text.
 * @returns the decoded path, or the input when it is not valid percent-encoding.
 */
function decodePath(value) {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

/**
 * Drop `.`/`..` segments and duplicate separators.
 * @param value - an absolute or relative `/`-separated path.
 * @returns the normalized path, keeping a leading `/` for absolute input.
 */
export function normalizePath(value) {
	const absolute = value.startsWith('/')
	const segments = []
	for (const segment of value.split('/')) {
		if (segment === '' || segment === '.') continue
		if (segment === '..') segments.pop()
		else segments.push(segment)
	}
	return `${absolute ? '/' : ''}${segments.join('/')}`
}

/**
 * The directory holding one document, with a trailing separator.
 * @param absoluteDocumentPath - absolute path of the document, when known.
 * @returns the directory prefix, or an empty string when the document path is unknown.
 */
function documentDirectory(absoluteDocumentPath) {
	if (typeof absoluteDocumentPath !== 'string' || !absoluteDocumentPath.startsWith('/')) return ''
	const cut = absoluteDocumentPath.lastIndexOf('/')
	return cut < 0 ? '/' : absoluteDocumentPath.slice(0, cut + 1)
}

/**
 * Join a document directory and a relative destination.
 * @param directory - directory prefix from {@link documentDirectory}.
 * @param destination - a relative destination.
 * @returns the normalized absolute path, or `undefined` when the directory is unknown.
 */
function joinPath(directory, destination) {
	if (directory === '') return undefined
	return normalizePath(`${directory}${destination}`)
}

/**
 * Read the file path out of a `dsh-resource://file/session/<sessionId>/<path>` address.
 * @param address - any resource address.
 * @returns the decoded path, which may itself be absolute or workspace-relative.
 */
export function addressPath(address) {
	if (typeof address !== 'string') return ''
	const match = /^dsh-resource:\/\/file\/session\/[^/]+\/(.*)$/.exec(address)
	if (match === null) return ''
	return decodePath(match[1] ?? '')
}

/**
 * Resolve the absolute path of the document a preview is showing.
 * @param resourceAddress - the tab's original address.
 * @param snapshot - the standard `useResource` snapshot for that address, when available.
 * @returns the absolute path when the Host metadata or the address supplies one.
 */
export function documentAbsolutePath(resourceAddress, snapshot) {
	const value = snapshot !== null && typeof snapshot === 'object' ? snapshot.value : undefined
	if (value !== null && typeof value === 'object' && typeof value.absolutePath === 'string' && value.absolutePath !== '') {
		return value.absolutePath.replace(/\\/g, '/')
	}
	const path = addressPath(resourceAddress).replace(/\\/g, '/')
	return path.startsWith('/') ? path : undefined
}

