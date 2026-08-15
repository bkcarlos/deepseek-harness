/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-desktop`.
 * @module @deepseek-ai/dsh-host-desktop/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-desktop'

/** Cordis companion plugin name. */
export const name = 'host-desktop-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package is a transport bridge that emits no
 * cordis events of its own — the API protocol round-trip is asserted by the
 * apiproxy carrier suites, and the graph↔bundle consistency it reads is owned
 * by the `@deepseek-ai/dsh-client-modules` invariant.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
