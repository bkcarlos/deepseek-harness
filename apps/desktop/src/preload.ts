/**
 * Electron preload: expose `window.dshDesktop` — the desktop transport bridge
 * the client `connection` plugin reads as a {@link DesktopFetchBridge}, plus
 * the boot-manifest and bundle loaders the renderer bootstrap needs to compose
 * `__DSH_BOOT__` and materialize client plugin bundles over `file://`.
 * @module @deepseek-ai/dsh-desktop/preload
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopFetchHandle, DesktopFetchRequest, DesktopFetchResponse } from '@deepseek-ai/dsh-client-connection/client'
import { UPDATE_CHANNEL, type UpdateState } from './update.ts'

// One listener per in-flight request rides the shared push channels; the
// connection's startup opens many streams at once, so raise the emitter cap
// past the 10-listener default instead of warning on a benign transient.
ipcRenderer.setMaxListeners(100)

type ChunkMessage = { id: string; chunk: Uint8Array }
type HeadMessage = { id: string; status: number; statusText: string; headers: Record<string, string>; hasBody: boolean }
type EndMessage = { id: string }
type ErrorMessage = { id: string; message: string }

/** Message shape each shared push channel carries. */
interface PushMessageMap {
  'dsh:fetch-head': HeadMessage
  'dsh:fetch-chunk': ChunkMessage
  'dsh:fetch-end': EndMessage
  'dsh:fetch-error': ErrorMessage
}

/** Subscribe to one shared main→renderer push channel, filtering by request id. */
function subscribe<K extends keyof PushMessageMap>(
  channel: K,
  id: string,
  handler: (message: PushMessageMap[K]) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: PushMessageMap[K]): void => {
    if (message.id === id) handler(message)
  }
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}

/** Start one fetch request and expose its head promise, push channels, and cancellation. */
function makeRequest(input: DesktopFetchRequest): DesktopFetchHandle {
  const id = crypto.randomUUID()
  let resolveHead!: (head: DesktopFetchResponse) => void
  let rejectHead!: (error: Error) => void
  const head = new Promise<DesktopFetchResponse>((resolve, reject) => {
    resolveHead = resolve
    rejectHead = reject
  })
  const chunks = new Set<(chunk: Uint8Array) => void>()
  const ends = new Set<() => void>()
  const errors = new Set<(error: Error) => void>()

  const offHead = subscribe('dsh:fetch-head', id, (message) => {
    resolveHead({ status: message.status, statusText: message.statusText, headers: message.headers, hasBody: message.hasBody })
  })
  const offChunk = subscribe('dsh:fetch-chunk', id, (message) => {
    for (const listener of chunks) listener(message.chunk)
  })
  const offEnd = subscribe('dsh:fetch-end', id, () => {
    for (const listener of ends) listener()
    cleanup()
  })
  const offError = subscribe('dsh:fetch-error', id, (message) => {
    const error = new Error(message.message)
    rejectHead(error)
    for (const listener of errors) listener(error)
    cleanup()
  })
  function cleanup(): void {
    offHead()
    offChunk()
    offEnd()
    offError()
  }

  ipcRenderer.send('dsh:fetch', { id, ...input })

  return {
    response: head,
    onChunk(listener: (chunk: Uint8Array) => void) { chunks.add(listener) },
    onEnd(listener: () => void) { ends.add(listener) },
    onError(listener: (error: Error) => void) { errors.add(listener) },
    cancel() {
      ipcRenderer.send('dsh:cancel', { id })
      rejectHead(new Error('This operation was aborted'))
      cleanup()
    },
  }
}

/** Validate the main process's `dsh:bundle` reply at the IPC boundary (invoke returns `Promise<any>`). */
function isBundleContent(value: unknown): value is { contentType: string; body: Uint8Array } {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { contentType?: unknown }).contentType === 'string'
    && (value as { body?: unknown }).body instanceof Uint8Array
}

const bridge = {
  async getBootManifest(): Promise<unknown> {
    return ipcRenderer.invoke('dsh:boot')
  },
  async loadBundle(id: string): Promise<{ contentType: string; body: Uint8Array } | undefined> {
    const reply: unknown = await ipcRenderer.invoke('dsh:bundle', id)
    return isBundleContent(reply) ? reply : undefined
  },
  request(input: DesktopFetchRequest): DesktopFetchHandle {
    return makeRequest(input)
  },
  updates: {
    check(): Promise<unknown> {
      return ipcRenderer.invoke(UPDATE_CHANNEL.check)
    },
    install(): Promise<unknown> {
      return ipcRenderer.invoke(UPDATE_CHANNEL.install)
    },
    getState(): Promise<UpdateState> {
      return ipcRenderer.invoke(UPDATE_CHANNEL.state)
    },
    onEvent(listener: (state: UpdateState) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, state: UpdateState): void => {
        listener(state)
      }
      ipcRenderer.on(UPDATE_CHANNEL.event, handler)
      return () => { ipcRenderer.removeListener(UPDATE_CHANNEL.event, handler) }
    },
  },
  menu: {
    onAction(listener: (action: string) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, action: string): void => {
        listener(action)
      }
      ipcRenderer.on('dsh:menu', handler)
      return () => { ipcRenderer.removeListener('dsh:menu', handler) }
    },
  },
}

contextBridge.exposeInMainWorld('dshDesktop', bridge)
