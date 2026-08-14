/**
 * Desktop IPC carrier: IpcApiClient bridges AbstractApiClient's transport
 * aspect over a DesktopFetchBridge, so unary, respond, and the SSE event
 * streams ride one push-chunk channel while every protocol invariant stays
 * in the base class. These specs drive a fake bridge through the whole
 * surface: head resolution, chunk streaming, abort semantics, and the RPC
 * caller's body read.
 */
import { describe, expect, it } from 'vitest'
import {
  collectBodyText,
  IpcApiClient,
  type DesktopFetchBridge,
  type DesktopFetchHandle,
  type DesktopFetchRequest,
  type DesktopFetchResponse,
} from '../src/client/ipc-api-client.ts'
import { createIpcConnectionRpc } from '../src/client/rpc.ts'

const encoder = new TextEncoder()

/** Scripted bridge handle: the spec resolves the head and pushes chunks/end/error on demand. */
class FakeHandle implements DesktopFetchHandle {
  cancelled = false
  readonly response: Promise<DesktopFetchResponse>
  private resolveResponse!: (head: DesktopFetchResponse) => void
  private readonly chunkListeners = new Set<(chunk: Uint8Array) => void>()
  private readonly endListeners = new Set<() => void>()
  private readonly errorListeners = new Set<(error: Error) => void>()
  // Buffered events replay to later subscribers, matching a channel that holds
  // frames until the reader arrives (chunks may precede subscription).
  private readonly chunks: Uint8Array[] = []
  private ended = false
  private error: Error | null = null

  constructor(readonly input: DesktopFetchRequest) {
    this.response = new Promise((resolve) => {
      this.resolveResponse = resolve
    })
  }

  onChunk(listener: (chunk: Uint8Array) => void): void {
    for (const chunk of this.chunks) listener(chunk)
    this.chunkListeners.add(listener)
  }

  onEnd(listener: () => void): void {
    if (this.ended) listener()
    this.endListeners.add(listener)
  }

  onError(listener: (error: Error) => void): void {
    if (this.error !== null) listener(this.error)
    this.errorListeners.add(listener)
  }

  cancel(): void {
    this.cancelled = true
    if (this.error === null) this.fail(new Error('This operation was aborted'))
  }

  resolveHead(head: DesktopFetchResponse): void {
    this.resolveResponse(head)
  }

  push(chunk: Uint8Array): void {
    this.chunks.push(chunk)
    for (const listener of this.chunkListeners) listener(chunk)
  }

  end(): void {
    this.ended = true
    for (const listener of this.endListeners) listener()
  }

  fail(error: Error): void {
    this.error = error
    for (const listener of this.errorListeners) listener(error)
  }
}

class FakeBridge implements DesktopFetchBridge {
  readonly requests: FakeHandle[] = []

  request(input: DesktopFetchRequest): FakeHandle {
    const handle = new FakeHandle(input)
    this.requests.push(handle)
    return handle
  }
}

const head = (over: Partial<DesktopFetchResponse> = {}): DesktopFetchResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  hasBody: true,
  ...over,
})

describe('IpcApiClient', () => {
  it('carries unary calls over the bridge and parses the echoed envelope', async () => {
    const bridge = new FakeBridge()
    const client = new IpcApiClient(bridge)
    const response = client.host.describe({})
    const handle = bridge.requests[0]!
    expect(handle.input).toMatchObject({
      url: 'http://dsh.internal/api/host.describe',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    const envelope = JSON.parse(handle.input.body as string) as { rpcId: string }
    handle.resolveHead(head())
    handle.push(encoder.encode(JSON.stringify({
      type: 'server-response',
      rpcId: envelope.rpcId,
      result: { ok: true, value: { version: '0.1.0', cwd: '/tmp', attachedSessions: 0, canOpenPath: true } },
    })))
    handle.end()
    await expect(response).resolves.toEqual({
      rpcId: envelope.rpcId,
      result: { ok: true, value: { version: '0.1.0', cwd: '/tmp', attachedSessions: 0, canOpenPath: true } },
    })
  })

  it('streams SSE frames through the inherited readSse path', async () => {
    const bridge = new FakeBridge()
    const client = new IpcApiClient(bridge)
    const abort = new AbortController()
    const iterator = client.events.mux({}, abort.signal)[Symbol.asyncIterator]()
    const next = iterator.next()
    const handle = bridge.requests[0]!
    expect(handle.input.method).toBe('GET')
    expect(handle.input.url).toBe('http://dsh.internal/api/events.mux')
    handle.resolveHead(head())
    handle.push(encoder.encode('data: {"type":"server-request","rpcId":"mux-1","method":"session/subscribed","payload":{"type":"session/subscribed","sessionId":"s-1","lastSeq":0}}\n\n'))
    handle.end()
    await expect(next).resolves.toMatchObject({
      value: { rpcId: 'mux-1', payload: { type: 'session/subscribed', sessionId: 's-1' } },
    })
    abort.abort()
    await expect(iterator.next()).resolves.toMatchObject({ done: true })
  })

  it('resolves a bodyless response with a null body', async () => {
    const bridge = new FakeBridge()
    const client = new IpcApiClient(bridge)
    const pending = client.host.describe({})
    const handle = bridge.requests[0]!
    handle.resolveHead(head({ hasBody: false, status: 204 }))
    handle.end()
    // The envelope is absent, so the schema parse rejects — the transport hop is what matters.
    await expect(pending).rejects.toThrow()
    expect(handle.cancelled).toBe(false)
  })

  it('rejects immediately when the external signal was already aborted', async () => {
    const bridge = new FakeBridge()
    const client = new IpcApiClient(bridge)
    const abort = new AbortController()
    abort.abort()
    await expect(client.host.describe({}, abort.signal)).rejects.toThrow('This operation was aborted')
    expect(bridge.requests[0]?.cancelled).toBe(true)
  })

  it('cancels and rejects when the signal aborts mid-flight', async () => {
    const bridge = new FakeBridge()
    const client = new IpcApiClient(bridge)
    const abort = new AbortController()
    const pending = client.host.describe({}, abort.signal)
    const handle = bridge.requests[0]!
    abort.abort()
    await expect(pending).rejects.toThrow('This operation was aborted')
    expect(handle.cancelled).toBe(true)
  })

  it('collectBodyText drains chunked bodies and returns empty for bodyless responses', async () => {
    const bridge = new FakeBridge()
    const handle = bridge.request({ url: 'http://x/api/rpc', method: 'POST', headers: {} })
    handle.resolveHead(head())
    handle.push(encoder.encode('{"hello":'))
    handle.push(encoder.encode('"world"}'))
    handle.end()
    await expect(collectBodyText(handle)).resolves.toBe('{"hello":"world"}')

    const empty = bridge.request({ url: 'http://x/api/rpc', method: 'POST', headers: {} })
    empty.resolveHead(head({ hasBody: false }))
    empty.end()
    await expect(collectBodyText(empty)).resolves.toBe('')
  })

  it('collectBodyText propagates a stream failure', async () => {
    const bridge = new FakeBridge()
    const handle = bridge.request({ url: 'http://x/api/rpc', method: 'POST', headers: {} })
    handle.resolveHead(head())
    handle.fail(new Error('stream broke'))
    await expect(collectBodyText(handle)).rejects.toThrow('stream broke')
  })
})

describe('createIpcConnectionRpc', () => {
  it('mints the envelope, reads the body, and validates correlation', async () => {
    const bridge = new FakeBridge()
    const rpc = createIpcConnectionRpc(bridge)
    const pending = rpc.call('/api', 'goals/create', { args: { agentId: 'a' } })
    const handle = bridge.requests[0]!
    expect(handle.input.url).toBe('http://dsh.internal/api/goals/create')
    const envelope = JSON.parse(handle.input.body as string) as { rpcId: string }
    handle.resolveHead(head())
    handle.push(encoder.encode(JSON.stringify({
      type: 'server-response',
      rpcId: envelope.rpcId,
      result: { ok: true, value: { ref: 'goal-1' } },
    })))
    handle.end()
    await expect(pending).resolves.toEqual({ ok: true, value: { ref: 'goal-1' } })
  })

  it('rejects a transport-level mismatch in rpcId', async () => {
    const bridge = new FakeBridge()
    const rpc = createIpcConnectionRpc(bridge)
    const pending = rpc.call('/api', 'goals/create', {})
    const handle = bridge.requests[0]!
    handle.resolveHead(head())
    handle.push(encoder.encode(JSON.stringify({
      type: 'server-response',
      rpcId: 'someone-else',
      result: { ok: true, value: null },
    })))
    handle.end()
    await expect(pending).rejects.toThrow('rpcId mismatch')
  })

  it('cancels the handle when the caller signal aborts', async () => {
    const bridge = new FakeBridge()
    const rpc = createIpcConnectionRpc(bridge)
    const abort = new AbortController()
    const pending = rpc.call('/api', 'goals/create', {}, abort.signal)
    const handle = bridge.requests[0]!
    abort.abort()
    await expect(pending).rejects.toThrow()
    expect(handle.cancelled).toBe(true)
  })
})
