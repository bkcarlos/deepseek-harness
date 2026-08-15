/**
 * Host-side desktop transport bridge (`ctx.desktop`): the Electron desktop
 * surface's carrier-agnostic face over the already-booted Cordis tree. It is
 * a Service, not the Electron adapter — the `ipcMain` wiring lives in the
 * `apps/desktop` shell, which serializes {@link DesktopHostService.fetch}
 * responses and {@link DesktopHostService.bundle} bodies over the bridge the
 * client {@link IpcApiClient} reads. Reuses the host RPC registry
 * (`HostConnectionService`) so Typert Remote interceptors compose exactly as
 * they do over HTTP, minus the network trust fence (an IPC renderer on the
 * same machine is loopback-trusted by construction).
 * @module @deepseek-ai/dsh-host-desktop
 */

import { readFileSync } from 'node:fs'
import { Context, Service } from '@deepseek-ai/cordis'
import { API_PATH, HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import type {} from '@deepseek-ai/dsh-client-modules'
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import type {} from '@deepseek-ai/dsh-host-apiproxy'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The desktop transport bridge (provided by the desktop host service). */
    desktop: DesktopHostService
  }
}

/** A client bundle's content and media type (the renderer executes it as a classic script). */
export interface DesktopBundleContent {
  /** Media type; always `text/javascript; charset=utf-8` for plugin bundles. */
  contentType: string
  /** Bundle bytes. */
  body: Uint8Array
}

/**
 * The desktop host service: the boot-manifest graph, per-entry bundle bytes,
 * and the fetch-shaped API gateway (unary plus SSE streams) the Electron
 * shell bridges over IPC. Provides `ctx.desktop` and `ctx.connection` (the
 * host RPC registry `api-remotes` intercepts).
 */
export class DesktopHostService extends Service {
  static inject = ['apiProxy', 'clientModules', 'connection']

  private readonly fetchHandler: ReturnType<HostConnectionService['createSharedFetchHandler']>

  /**
   * Provide the desktop bridge over the settled host services. It reuses the
   * host RPC registry the `client-connection` node half provides on
   * `ctx.connection`, so Typert Remote interceptors (`api-remotes`) compose
   * into the shared `/api` fetch handler identically to the HTTP path.
   * @param ctx - plugin context carrying `apiProxy`, `clientModules`, and `connection`.
   */
  constructor(ctx: Context) {
    super(ctx, 'desktop')
    const connection = ctx.get('connection') as HostConnectionService
    this.fetchHandler = connection.createSharedFetchHandler(API_PATH, toFetchHandler(ctx.apiProxy))
  }

  /**
   * The composed client entry graph (what the browser reads as `window.__DSH_BOOT__`).
   * @returns the client-modules boot manifest.
   */
  graph(): WebBootGraph {
    return this.ctx.clientModules.graph()
  }

  /**
   * Bundle bytes for a client entry id, read from the client-modules table.
   * @param id - client entry name (package name).
   * @returns the bundle content, or undefined for an unknown id.
   */
  bundle(id: string): DesktopBundleContent | undefined {
    const path = this.ctx.clientModules.clientPath(id)
    if (path === undefined) return undefined
    // Plain Uint8Array, not Buffer: the shell's IPC serialization sees the
    // wire type directly rather than Buffer-specific metadata.
    return { contentType: 'text/javascript; charset=utf-8', body: new Uint8Array(readFileSync(path)) }
  }

  /**
   * Fetch-shaped API transport: unary and respond are complete JSON bodies;
   * the event streams return an SSE Response whose body the shell streams.
   * @param request - the reconstructed request (fake authority, routed by pathname).
   * @returns the host's response.
   */
  fetch(request: Request): Promise<Response> {
    return this.fetchHandler.fetch(request)
  }
}

export default DesktopHostService
