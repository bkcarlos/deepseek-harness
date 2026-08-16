/** Desktop menu-action bridge: dispatch the native menu bar's commands to the client services. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * A native menu command that a feature surface (the settings shell) renders.
     * @param action - the menu action name.
     * @mode emit
     */
    'desktop/menu': (action: string) => void
  }
}

/** The preload-exposed menu surface (a subset of window.dshDesktop). */
export interface DesktopMenuApi {
  onAction(listener: (action: string) => void): () => void
}

/**
 * Read the desktop menu surface.
 * @returns the preload API, or undefined in a plain web surface.
 */
export function readDesktopMenu(): DesktopMenuApi | undefined {
  return (globalThis as { dshDesktop?: { menu?: DesktopMenuApi } }).dshDesktop?.menu
}

/** Services required before the menu actions can dispatch. */
export const inject = ['workspaces']

/**
 * Subscribe to the native menu commands and dispatch them. new-session and
 * open-folder resolve through the workspaces service directly; every other
 * action (open-settings today) re-emits as a cordis event for the feature that
 * owns its surface.
 * @param ctx - client root context carrying the workspaces service.
 */
export function apply(ctx: ClientContext): void {
  const menu = readDesktopMenu()
  if (menu === undefined) return
  const dispose = menu.onAction((action) => {
    if (action === 'new-session') {
      ctx.workspaces.startSession()
      return
    }
    if (action === 'open-folder') {
      void openWorkspaceFolder(ctx)
      return
    }
    ctx.emit('desktop/menu', action)
  })
  ctx.effect(() => dispose, 'ui-desktop-menu: menu actions')
}

/**
 * Open a folder as a new workspace: run the native picker, register the path,
 * and start a session there. A cancelled pick or failed adoption is a no-op —
 * the workspace flow already surfaced the failure.
 * @param ctx - client root context carrying the workspaces service.
 */
async function openWorkspaceFolder(ctx: ClientContext): Promise<void> {
  const path = await ctx.workspaces.pickDirectory()
  if (path === null) return
  try {
    const workspace = await ctx.workspaces.create({ path })
    ctx.workspaces.startSession(workspace.workspaceId)
  } catch {
    // Adoption failure already surfaced through the workspace error surface.
  }
}
