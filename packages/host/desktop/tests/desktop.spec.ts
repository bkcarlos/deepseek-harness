/**
 * Desktop host bridge: the carrier-agnostic face over a booted tree. These
 * specs prove the three surfaces the Electron shell bridges — the boot graph,
 * per-entry bundle bytes, and the fetch-shaped API gateway (unary and the SSE
 * event stream) — without importing Electron.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import type { ApiProxy, RpcRequest, MuxFrame } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { ClientModuleRegistry, WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { afterEach, describe, expect, it } from 'vitest'
import { DesktopHostService } from '../src/index.ts'
import { apply as applyInvariant, inject, name } from '../src/invariant.ts'

let root: string | undefined

afterEach(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true })
  root = undefined
})

const graph: WebBootGraph = {
  rev: 'rev-1',
  entries: [{ id: '@desktop/plugin', url: '/plugins/@desktop/plugin/client.js?rev=rev-1', rev: 'rev-1' }],
}

/** A host tree whose client-modules table resolves one on-disk bundle. */
function makeClientModules(): { registry: ClientModuleRegistry; bundlePath: string } {
  root = mkdtempSync(join(tmpdir(), 'dsh-host-desktop-'))
  const bundlePath = join(root, 'client.js')
  writeFileSync(bundlePath, 'window.__ModuleLoader__.load({})\n')
  const registry = {
    graph: () => graph,
    clientPath: (id: string) => (id === '@desktop/plugin' ? bundlePath : undefined),
  } as unknown as ClientModuleRegistry
  return { registry, bundlePath }
}

/** Minimal ApiProxy exercising the two routes the bridge test reaches. */
function makeApiProxy(): ApiProxy {
  return {
    host: {
      async describe(request: RpcRequest<Record<string, never>>) {
        return {
          rpcId: request.rpcId,
          result: { ok: true, value: { version: '0.1.0', cwd: '/tmp', attachedSessions: 0, canOpenPath: true } },
        }
      },
    },
    events: {
      async *mux(): AsyncGenerator<RpcRequest<MuxFrame>> {
        yield { rpcId: RpcId('mux-1'), payload: { type: 'session/subscribed', sessionId: 's-1' as SessionId, lastSeq: 0 } }
      },
    },
  } as unknown as ApiProxy
}

function construct(): { desktop: DesktopHostService; bundlePath: string } {
  const { registry, bundlePath } = makeClientModules()
  const ctx = new Context()
  ctx.provide('apiProxy', makeApiProxy())
  ctx.provide('clientModules', registry)
  // The client-connection node half owns the host RPC registry; the desktop
  // service reuses it rather than constructing a second one.
  new HostConnectionService(ctx, [])
  return { desktop: new DesktopHostService(ctx), bundlePath }
}

describe('DesktopHostService', () => {
  it('exposes the composed boot graph', () => {
    expect(construct().desktop.graph()).toBe(graph)
  })

  it('reads a known bundle and reports unknown ids as undefined', () => {
    const { desktop, bundlePath } = construct()
    expect(desktop.bundle('@desktop/plugin')).toEqual({
      contentType: 'text/javascript; charset=utf-8',
      body: new TextEncoder().encode('window.__ModuleLoader__.load({})\n'),
    })
    expect(desktop.bundle('@desktop/missing')).toBeUndefined()
    void bundlePath
  })

  it('bridges a unary call through the composed fetch handler', async () => {
    const { desktop } = construct()
    const response = await desktop.fetch(new Request('http://dsh.internal/api/host.describe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'r-1', method: 'host.describe', payload: {} }),
    }))
    await expect(response.json()).resolves.toEqual({
      type: 'server-response',
      rpcId: 'r-1',
      result: { ok: true, value: { version: '0.1.0', cwd: '/tmp', attachedSessions: 0, canOpenPath: true } },
    })
  })

  it('serves the event stream as an SSE body', async () => {
    const { desktop } = construct()
    const response = await desktop.fetch(new Request('http://dsh.internal/api/events.mux'))
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    const text = await response.text()
    expect(text).toContain('session/subscribed')
    expect(text).toContain('"rpcId":"mux-1"')
  })
})

describe('host-desktop invariant companion', () => {
  it('registers the no-op installer under the package name and returns its disposer', async () => {
    const disposer = () => {}
    const registered: Array<[string, () => void]> = []
    const ctx = {
      invariants: {
        register: (pkg: string, install: () => void) => {
          registered.push([pkg, install])
          return disposer
        },
      },
    } as unknown as Context
    expect(name).toBe('host-desktop-invariant')
    expect(inject).toEqual(['invariants'])
    await expect(applyInvariant(ctx)).resolves.toBe(disposer)
    expect(registered).toHaveLength(1)
    expect(registered[0]?.[0]).toBe('@deepseek-ai/dsh-host-desktop')
    // The installer is a documented no-op; invoking it proves the companion
    // ships a runnable body rather than an inert placeholder.
    registered[0]?.[1]()
  })
})
