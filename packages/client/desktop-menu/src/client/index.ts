/** Desktop menu-action bridge: dispatch the native menu bar's commands to the client services. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** The preload-exposed menu surface (a subset of window.dshDesktop). */
export interface DesktopMenuApi {
  onAction(listener: (action: string) => void): () => void
}

/** Read the desktop menu surface, absent in a plain web surface. */
export function readDesktopMenu(): DesktopMenuApi | undefined {
  return (globalThis as { dshDesktop?: { menu?: DesktopMenuApi } }).dshDesktop?.menu
}

/** Services required before the menu actions can dispatch. */
export const inject = ['workspaces']

/**
 * Subscribe to the native menu commands and dispatch them to the client
 * services. The only action today is new-session; the subscription is a
 * single seat future actions join without a second listener.
 * @param ctx - client root context carrying the workspaces service.
 */
export function apply(ctx: ClientContext): void {
  const menu = readDesktopMenu()
  if (menu === undefined) return
  const dispose = menu.onAction((action) => {
    if (action === 'new-session') ctx.workspaces.startSession()
  })
  ctx.effect(() => dispose, 'ui-desktop-menu: menu actions')
}
