/**
 * Electron IPC carrier for the browser API client. The desktop preload
 * exposes {@link DesktopFetchBridge} on `window.dshDesktop`; this subclass
 * bridges {@link AbstractApiClient}'s `doFetch` transport aspect over it, so
 * every protocol invariant — rpcId minting, envelope wrap/unwrap, zod parsing,
 * unary timeout, SSE frame decoding — stays in the base class. The IPC bridge
 * is a physical channel for the same `Request`/`Response` the HTTP and
 * in-process carriers already move, which is why only the transport aspect
 * differs.
 *
 * A bridge request resolves its response head (status/headers) once, then
 * pushes body chunks through listener callbacks. The abstract client's
 * unary path (`response.json()`) and SSE path (`response.body.getReader()`)
 * both consume that stream without knowing the bytes crossed IPC.
 */

import { AbstractApiClient } from './api.ts'

/** One IPC fetch request: the fetch input plus its JSON-string body (unary POSTs). */
export interface DesktopFetchRequest {
  /** Absolute request URL; the bridge routes by pathname, so the authority is a fake internal host. */
  url: string
  /** HTTP method (GET for streams, POST for unary/respond). */
  method: string
  /** Flat header map. */
  headers: Record<string, string>
  /** Request body text; absent for bodyless requests (stream opens). */
  body?: string
}

/** Response head the main process returns before any body chunk. */
export interface DesktopFetchResponse {
  /** HTTP status. */
  status: number
  /** HTTP status text. */
  statusText: string
  /** Flat header map. */
  headers: Record<string, string>
  /** Whether the response carries a body stream (false → null body). */
  hasBody: boolean
}

/** One in-flight bridge request: the response head plus the push body channel and cancellation. */
export interface DesktopFetchHandle {
  /** Resolves with the response head once the main process replies. */
  readonly response: Promise<DesktopFetchResponse>
  /** Subscribe to body chunks (before end/error). */
  onChunk(listener: (chunk: Uint8Array) => void): void
  /** Subscribe to normal stream completion. */
  onEnd(listener: () => void): void
  /** Subscribe to a request or stream failure. */
  onError(listener: (error: Error) => void): void
  /**
   * Cancel the request. An open stream then receives `onError` (an abort
   * error); the response-head promise is left untouched — cancellation is
   * stream teardown, not a head failure.
   */
  cancel(): void
}

/** Transport bridge the desktop preload exposes as `window.dshDesktop`. */
export interface DesktopFetchBridge {
  request(input: DesktopFetchRequest): DesktopFetchHandle
}

/** Window face the preload mounts the bridge onto (read by the carrier selection in the plugin body). */
export interface DshDesktopWindow {
  /** Desktop IPC bridge; present only when running inside the Electron shell. */
  dshDesktop?: DesktopFetchBridge
}

/**
 * Mirror fetch's abort rejection: the signal's reason when present, else an AbortError.
 * @param signal - the aborted signal whose reason (if any) names the failure.
 * @returns the signal's reason as an Error, or a generic abort Error.
 */
export function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  if (reason instanceof Error) return reason
  if (typeof reason === 'string') return new Error(reason)
  return new Error('This operation was aborted')
}

/** Normalize a fetch HeadersInit to the bridge's flat header map. */
function headersOf(init?: RequestInit): Record<string, string> {
  return Object.fromEntries(new Headers(init?.headers ?? {}).entries())
}

/** Convert a push-chunk handle into an async chunk generator (ends on onEnd, throws on onError/cancel). */
async function* toAsyncChunks(handle: DesktopFetchHandle): AsyncGenerator<Uint8Array> {
  const queue: Uint8Array[] = []
  let wake: (() => void) | null = null
  // The push callbacks mutate this shared state between the loop's awaits, so
  // the loop reads it through the box instead of narrowed local bindings.
  const state: { ended: boolean; failure: Error | null } = { ended: false, failure: null }
  handle.onChunk((chunk) => {
    queue.push(chunk)
    wake?.()
    wake = null
  })
  handle.onEnd(() => {
    state.ended = true
    wake?.()
    wake = null
  })
  handle.onError((error) => {
    state.failure = error
    wake?.()
    wake = null
  })
  while (true) {
    const next = queue.shift()
    if (next !== undefined) {
      yield next
      continue
    }
    if (state.failure !== null) throw state.failure
    if (state.ended) return
    await new Promise<void>((resolve) => { wake = resolve })
  }
}

/**
 * Whole-body text of a bridge response (the RPC caller's carrier read path).
 * @param handle - the in-flight bridge request to drain.
 * @returns the decoded body text, or '' for a bodyless response.
 */
export async function collectBodyText(handle: DesktopFetchHandle): Promise<string> {
  const head = await handle.response
  if (!head.hasBody) return ''
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of toAsyncChunks(handle)) text += decoder.decode(chunk, { stream: true })
  return text + decoder.decode()
}

/** Flatten a push-chunk handle into a WHATWG ReadableStream for `new Response(body, …)`. */
function bodyStream(handle: DesktopFetchHandle, signal: AbortSignal | undefined): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // The caller's signal cancels the in-flight request for the whole read;
      // the base readSse only reaches `reader.cancel()` after the stream has
      // already closed or errored, so a separate cancel callback is unreachable.
      const onAbort = (): void => { handle.cancel() }
      signal?.addEventListener('abort', onAbort, { once: true })
      try {
        for await (const chunk of toAsyncChunks(handle)) controller.enqueue(chunk)
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }
    },
  })
}

/**
 * Desktop platform subclass: unary/respond and the SSE event streams all ride
 * one IPC bridge. `doFetch` is the only transport aspect — `openMux`/`openHost`
 * fall through to the base `readSse`, which reads the reconstructed Response body.
 */
export class IpcApiClient extends AbstractApiClient {
  constructor(private readonly bridge: DesktopFetchBridge, timeoutMs?: number) {
    super(timeoutMs)
  }

  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    const signal = init?.signal ?? undefined
    const handle = this.bridge.request({
      url: input.href,
      method: init?.method ?? 'GET',
      headers: headersOf(init),
      ...typeof init?.body === 'string' ? { body: init.body } : {},
    })
    if (signal === undefined) return this.resolve(handle, undefined)
    if (signal.aborted) {
      handle.cancel()
      return Promise.reject(abortError(signal))
    }
    // Faithful to real fetch: reject on signal abort during the head phase;
    // the stream phase ties the same signal to cancel inside bodyStream.
    return new Promise<Response>((resolve, reject) => {
      const onAbort = (): void => {
        handle.cancel()
        reject(abortError(signal))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      this.resolve(handle, signal)
        .then(resolve, reject)
        .finally(() => { signal.removeEventListener('abort', onAbort) })
    })
  }

  private async resolve(handle: DesktopFetchHandle, signal: AbortSignal | undefined): Promise<Response> {
    const head = await handle.response
    const body = head.hasBody ? bodyStream(handle, signal) : null
    return new Response(body, { status: head.status, statusText: head.statusText, headers: head.headers })
  }
}
