/**
 * Desktop renderer entry: the thin bootstrap over the shell library, like
 * `apps/web/src/main.ts` but for the Electron surface. It reads the boot graph
 * and client bundles over the IPC bridge (no HTTP server), composes
 * `window.__DSH_BOOT__` before the shell parses it, and hands the shell a
 * `loadBundle` seam that executes bundle bytes in-page.
 * @module @deepseek-ai/dsh-desktop/renderer
 */

import type { WebBootGraph, DshWindow } from '@deepseek-ai/dsh-client-modules/client'
import { AppWebEntry } from '@deepseek-ai/dsh-client-web'

/** The bridge face the renderer bootstrap consumes (the preload exposes more for the client plugin). */
interface DshDesktopApi {
  getBootManifest(): Promise<WebBootGraph>
  loadBundle(id: string): Promise<{ contentType: string; body: Uint8Array } | undefined>
}

/** Derive a client entry id from its graph row URL (`/plugins/<id>/client.js?rev=…`). */
function idFromBundleUrl(url: string): string | undefined {
  if (!url.startsWith('/plugins/')) return undefined
  return url.slice('/plugins/'.length).replace(/\/client\.js(\.map)?(\?.*)?$/, '')
}

/** Execute a classic-script bundle in the page (registers its module factory). */
function executeScript(source: string): void {
  const script = document.createElement('script')
  script.textContent = source
  document.head.append(script)
  script.remove()
}

/** Bootstrap the desktop shell over the IPC bridge. */
async function main(): Promise<void> {
  const bridge = (globalThis as { dshDesktop?: DshDesktopApi }).dshDesktop
  if (bridge === undefined) throw new Error('desktop: window.dshDesktop is missing (preload did not run)')

  const manifest = await bridge.getBootManifest()
  ;(globalThis as DshWindow).__DSH_BOOT__ = manifest

  const el = document.getElementById('root')
  if (el === null) throw new Error('desktop: missing #root')

  void new AppWebEntry(el, {
    loadBundle: async (url) => {
      const id = idFromBundleUrl(url)
      if (id === undefined) throw new Error(`desktop: cannot resolve bundle id from ${url}`)
      const result = await bridge.loadBundle(id)
      if (result === undefined) throw new Error(`desktop: no bundle for ${id}`)
      executeScript(new TextDecoder().decode(result.body))
    },
  }).run()
}

/** Show a boot failure in the page instead of leaving a blank window. */
function renderFatal(error: unknown): void {
  console.error('desktop: boot failed:', error)
  const root = document.getElementById('root')
  if (root === null) return
  const message = error instanceof Error ? error.message : String(error)
  const pre = document.createElement('pre')
  pre.style.cssText = 'padding:2rem;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;color:#c00'
  pre.textContent = `DeepSeek Harness failed to start:\n\n${message}`
  root.replaceChildren(pre)
}

void main().catch(renderFatal)
