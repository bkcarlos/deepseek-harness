/**
 * Electron preload: expose `window.dshDesktop` — the desktop transport bridge
 * the client `connection` plugin reads as a {@link DesktopFetchBridge}, plus
 * the boot-manifest and bundle loaders the renderer bootstrap needs to compose
 * `__DSH_BOOT__` and materialize client plugin bundles over `file://`.
 * @module @deepseek-ai/dsh-desktop/preload
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopFetchHandle, DesktopFetchRequest, DesktopFetchResponse } from '@deepseek-ai/dsh-client-connection/client'

// One listener per in-flight request rides the shared push channels; the
// connection's startup opens many streams at once, so raise the emitter cap
// past the 10-listener default instead of warning on a benign transient.
ipcRenderer.setMaxListeners(100)

type ChunkMessage = { id: string; chunk: Uint8Array }
type HeadMessage = { id: string; status: number; statusText: string; headers: Record<string, string>; hasBody: boolean }
type EndMessage = { id: string }
type ErrorMessage = { id: string; message: string }

/** Subscribe to one shared main→renderer push channel, filtering by request id. */
function subscribe<T extends { id: string }>(
  channel: string,
  id: string,
  handler: (message: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: T): void => {
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

  const offHead = subscribe<HeadMessage>('dsh:fetch-head', id, (message) => {
    resolveHead({ status: message.status, statusText: message.statusText, headers: message.headers, hasBody: message.hasBody })
  })
  const offChunk = subscribe<ChunkMessage>('dsh:fetch-chunk', id, (message) => {
    for (const listener of chunks) listener(message.chunk)
  })
  const offEnd = subscribe<EndMessage>('dsh:fetch-end', id, () => {
    for (const listener of ends) listener()
    cleanup()
  })
  const offError = subscribe<ErrorMessage>('dsh:fetch-error', id, (message) => {
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
    onChunk(listener) { chunks.add(listener) },
    onEnd(listener) { ends.add(listener) },
    onError(listener) { errors.add(listener) },
    cancel() {
      ipcRenderer.send('dsh:cancel', { id })
      rejectHead(new Error('This operation was aborted'))
      cleanup()
    },
  }
}

const bridge = {
  async getBootManifest(): Promise<unknown> {
    return ipcRenderer.invoke('dsh:boot')
  },
  async loadBundle(id: string): Promise<{ contentType: string; body: Uint8Array } | undefined> {
    return ipcRenderer.invoke('dsh:bundle', id)
  },
  request(input: DesktopFetchRequest): DesktopFetchHandle {
    return makeRequest(input)
  },
}

contextBridge.exposeInMainWorld('dshDesktop', bridge)
