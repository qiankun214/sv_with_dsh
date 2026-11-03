/**
 * dsh-markdown-media — node half.
 *
 * This package is a pure browser-UI extension: the browser bundle ships through
 * `exports["./client"]` and is discovered from the package's `dsh.client`
 * declaration. The empty `apply` exists only so the host composition can mount
 * the package as an ordinary Loader row, which is what puts it in the client
 * boot graph.
 */

/** Host plugin body — no host-side behaviour for this browser extension. */
export function apply() {}
