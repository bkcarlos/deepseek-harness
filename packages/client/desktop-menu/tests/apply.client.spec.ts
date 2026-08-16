import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, readDesktopMenu, type DesktopMenuApi } from '../src/client/index.ts'

async function bench() {
  const ctx = new Context()
  const workspaces = {
    startSession: vi.fn(),
    pickDirectory: vi.fn(async () => '/tmp/project' as string | null),
    create: vi.fn(async () => ({ workspaceId: 'ws-1' } as never)),
  }
  ctx.provide('workspaces', workspaces)
  const listeners: Array<(action: string) => void> = []
  const unsubscribe = vi.fn()
  const api: DesktopMenuApi = { onAction: (listener) => { listeners.push(listener); return unsubscribe } }
  ;(globalThis as { dshDesktop?: unknown }).dshDesktop = { menu: api }
  return { ctx, workspaces, listeners, unsubscribe }
}

function cleanupDesktop() {
  delete (globalThis as { dshDesktop?: unknown }).dshDesktop
}

describe('ui-desktop-menu', () => {
  it('declares the service it dispatches to', () => {
    expect(inject).toEqual(['workspaces'])
  })

  it('reads the preload menu surface or returns undefined', () => {
    const api: DesktopMenuApi = { onAction: () => () => {} }
    ;(globalThis as { dshDesktop?: unknown }).dshDesktop = { menu: api }
    expect(readDesktopMenu()).toBe(api)
    delete (globalThis as { dshDesktop?: unknown }).dshDesktop
    expect(readDesktopMenu()).toBeUndefined()
  })

  it('dispatches new-session to the workspaces service and unsubscribes on teardown', async () => {
    const b = await bench()
    try {
      const fiber = b.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      b.listeners[0]!('new-session')
      expect(b.workspaces.startSession).toHaveBeenCalledOnce()
      await fiber.dispose()
      expect(b.unsubscribe).toHaveBeenCalledOnce()
    } finally {
      cleanupDesktop()
    }
  })

  it('opens a folder as a workspace and starts a session there', async () => {
    const b = await bench()
    try {
      const fiber = b.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      b.listeners[0]!('open-folder')
      await vi.waitFor(() => { expect(b.workspaces.startSession).toHaveBeenCalledWith('ws-1') })
      expect(b.workspaces.pickDirectory).toHaveBeenCalledOnce()
      expect(b.workspaces.create).toHaveBeenCalledWith({ path: '/tmp/project' })
      await fiber.dispose()
    } finally {
      cleanupDesktop()
    }
  })

  it('cancels the folder flow when the pick is cancelled', async () => {
    const b = await bench()
    b.workspaces.pickDirectory = vi.fn(async () => null as string | null)
    try {
      const fiber = b.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      b.listeners[0]!('open-folder')
      await vi.waitFor(() => { expect(b.workspaces.pickDirectory).toHaveBeenCalledOnce() })
      expect(b.workspaces.create).not.toHaveBeenCalled()
      expect(b.workspaces.startSession).not.toHaveBeenCalled()
      await fiber.dispose()
    } finally {
      cleanupDesktop()
    }
  })

  it('swallows a failed workspace adoption', async () => {
    const b = await bench()
    b.workspaces.create = vi.fn(async () => { throw new Error('duplicate') })
    try {
      const fiber = b.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      b.listeners[0]!('open-folder')
      await vi.waitFor(() => { expect(b.workspaces.create).toHaveBeenCalledOnce() })
      expect(b.workspaces.startSession).not.toHaveBeenCalled()
      await fiber.dispose()
    } finally {
      cleanupDesktop()
    }
  })

  it('re-emits unknown actions as a desktop/menu cordis event', async () => {
    const b = await bench()
    const seen: string[] = []
    b.ctx.on('desktop/menu', (action) => { seen.push(action) })
    try {
      const fiber = b.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      b.listeners[0]!('open-settings')
      expect(seen).toEqual(['open-settings'])
      await fiber.dispose()
    } finally {
      cleanupDesktop()
    }
  })

  it('no-ops without the desktop menu surface', async () => {
    const ctx = new Context()
    const startSession = vi.fn()
    ctx.provide('workspaces', { startSession } as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(startSession).not.toHaveBeenCalled()
    await fiber.dispose()
  })
})
