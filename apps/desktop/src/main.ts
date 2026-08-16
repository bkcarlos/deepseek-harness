/**
 * Electron main process for the dsh desktop surface: boot the harness tree in
 * process, wire `ctx.desktop` (boot graph, bundle bytes, fetch-shaped gateway)
 * over the IPC bridge, and open one BrowserWindow loading the built frontend
 * over `file://`. No HTTP server is started — the renderer's
 * {@link IpcApiClient} carries every API call and event stream through the
 * bridge below.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import type { DesktopBundleContent, DesktopHostService } from '@deepseek-ai/dsh-host-desktop'
import { bootDesktop } from './boot.ts'
import electronUpdater from 'electron-updater'
import { UPDATE_CHANNEL, type UpdateState } from './update.ts'
import { buildApplicationMenu } from './menu.ts'

const { autoUpdater } = electronUpdater

/**
 * Run one update check. Failures surface through the updater's 'error' event
 * (which drives the renderer state), never here; a development run carries no
 * packaged feed and is a no-op.
 */
async function runUpdateCheck(): Promise<void> {
  if (!app.isPackaged) return
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    // Already reflected through the 'error' event → state.
  }
}

/** IPC channel names, shared with the preload. */
const CHANNEL_BOOT = 'dsh:boot'
const CHANNEL_BUNDLE = 'dsh:bundle'
const CHANNEL_FETCH = 'dsh:fetch'
const CHANNEL_CANCEL = 'dsh:cancel'
const CHANNEL_FETCH_HEAD = 'dsh:fetch-head'
const CHANNEL_FETCH_CHUNK = 'dsh:fetch-chunk'
const CHANNEL_FETCH_END = 'dsh:fetch-end'
const CHANNEL_FETCH_ERROR = 'dsh:fetch-error'
const CHANNEL_MENU = 'dsh:menu'

/** One serialized fetch request the preload sends. */
interface DesktopFetchMessage {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

/** Resolve the built renderer index.html (source: ../dist; built: beside the packaged main). */
function indexHtmlPath(): string {
  return join(app.getAppPath(), 'dist', 'index.html')
}

/**
 * Install the IPC bridge over the booted desktop service and open the window.
 * @param desktop - the settled `ctx.desktop` bridge.
 */
function wireIpc(desktop: DesktopHostService): void {
  ipcMain.handle(CHANNEL_BOOT, () => desktop.graph())
  ipcMain.handle(CHANNEL_BUNDLE, (_event, id: unknown): DesktopBundleContent | undefined => {
    if (typeof id !== 'string') return undefined
    return desktop.bundle(id)
  })

  const inFlight = new Map<string, AbortController>()

  ipcMain.on(CHANNEL_FETCH, (event, message: DesktopFetchMessage) => {
    const abort = new AbortController()
    inFlight.set(message.id, abort)
    const request = new Request(message.url, {
      method: message.method,
      headers: message.headers,
      ...message.body !== undefined ? { body: message.body } : {},
      signal: abort.signal,
    })
    void (async () => {
      try {
        const response = await desktop.fetch(request)
        event.sender.send(CHANNEL_FETCH_HEAD, {
          id: message.id,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          hasBody: response.body !== null,
        })
        if (response.body === null) return
        for await (const chunk of response.body) {
          event.sender.send(CHANNEL_FETCH_CHUNK, { id: message.id, chunk })
        }
        event.sender.send(CHANNEL_FETCH_END, { id: message.id })
      } catch (error) {
        event.sender.send(CHANNEL_FETCH_ERROR, {
          id: message.id,
          message: error instanceof Error ? error.message : String(error),
        })
      } finally {
        inFlight.delete(message.id)
      }
    })()
  })

  ipcMain.on(CHANNEL_CANCEL, (_event, message: { id: string }) => {
    inFlight.get(message.id)?.abort()
    inFlight.delete(message.id)
  })
}

/** Boot the harness, install the bridge, and open the window. */
async function main(): Promise<void> {
  const ctx = await bootDesktop()
  const desktop = ctx.get('desktop')
  if (desktop === undefined) {
    throw new Error('dsh-desktop: ctx.desktop is missing after boot — is the desktop bundle composed?')
  }
  wireIpc(desktop)

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload is ESM (this app is `"type": "module"`), which Electron
      // only loads outside the renderer sandbox. The renderer still gets no
      // Node access (nodeIntegration: false, contextIsolation: true); only the
      // trusted preload runs unsandboxed to bridge `window.dshDesktop`.
      sandbox: false,
    },
  })
  // Forward renderer console and load failures to the main log so a blank
  // window is diagnosable from the CLI without opening DevTools.
  window.webContents.on('console-message', (_event, level, message) => {
    console.error(`[renderer:${level}] ${message}`)
  })
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[renderer] failed to load ${url}: ${code} ${description}`)
  })
  window.once('ready-to-show', () => { window.show() })
  await window.loadFile(indexHtmlPath())
  setupAutoUpdate(window)
  Menu.setApplicationMenu(buildApplicationMenu({
    checkForUpdates: () => { void runUpdateCheck() },
    newSession: () => { window.webContents.send(CHANNEL_MENU, 'new-session') },
  }))
}

/**
 * Install the GitHub-Releases auto-update bridge: drive electron-updater's
 * state machine, push every transition to the renderer, and serve the manual
 * check/install commands over IPC. The startup check downloads in the
 * background; applying it waits for the operator's explicit restart action,
 * so an update never interrupts a running session on its own. Failures — most
 * commonly an unsigned local build on macOS, whose update signature cannot be
 * verified — are reported as an `error` state and never fatal.
 * @param window - the sole BrowserWindow the update state broadcasts to.
 */
function setupAutoUpdate(window: BrowserWindow): void {
  let state: UpdateState = { phase: 'idle' }
  let version: string | undefined
  const broadcast = (): void => {
    if (!window.isDestroyed()) window.webContents.send(UPDATE_CHANNEL.event, state)
  }
  const setState = (next: UpdateState): void => {
    state = next
    broadcast()
  }

  ipcMain.handle(UPDATE_CHANNEL.state, () => state)
  ipcMain.handle(UPDATE_CHANNEL.check, () => runUpdateCheck())
  ipcMain.handle(UPDATE_CHANNEL.install, () => {
    setState({ phase: 'restarting' })
    // Silent install (no confirmation dialog) and relaunch after install.
    autoUpdater.quitAndInstall(true, true)
  })

  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => { setState({ phase: 'checking' }) })
  autoUpdater.on('update-available', (info) => {
    version = info.version
    setState({ phase: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', (info) => {
    setState({ phase: 'not-available', version: info.version })
  })
  autoUpdater.on('download-progress', (progress) => {
    setState({ phase: 'downloading', version: version ?? '', percent: progress.percent })
  })
  autoUpdater.on('update-downloaded', (info) => {
    setState({ phase: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (error) => {
    console.error('dsh-desktop: update error:', error)
    setState({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
  })
  void autoUpdater.checkForUpdates()
}

/** Render a non-Error thrown value without Object's default `[object Object]` stringification. */
function describeValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'function') return `[Function: ${value.name || '<anonymous>'}]`
  try {
    return JSON.stringify(value)
  } catch {
    // BigInt and cyclic structures stringify to a type tag rather than failing the boot log.
    return Object.prototype.toString.call(value)
  }
}

/** Flatten an AggregateError's per-entry failures so a boot failure names every unresolved plugin. */
function dumpError(error: unknown): string {
  const lines: string[] = []
  const seen = new Set<unknown>()
  const visit = (value: unknown, depth: number): void => {
    if (value === undefined || value === null || seen.has(value)) return
    seen.add(value)
    const prefix = '  '.repeat(depth)
    if (value instanceof AggregateError) {
      lines.push(`${prefix}AggregateError: ${value.message}`)
      for (const child of value.errors) visit(child, depth + 1)
      return
    }
    lines.push(`${prefix}${value instanceof Error ? value.stack ?? value.message : describeValue(value)}`)
  }
  visit(error, 0)
  return lines.join('\n')
}

// The `dsh:fetch` streaming bridge emits to a raw webContents, so keep the
// unhandled-rejection surface explicit rather than relying on a Node-style exit.
void app.whenReady().then(() => {
  void main().catch((error: unknown) => {
    console.error(`dsh-desktop: boot failed:\n${dumpError(error)}`)
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
