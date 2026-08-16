import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, readDesktopMenu, type DesktopMenuApi } from '../src/client/index.ts'

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
    const ctx = new Context()
    const startSession = vi.fn()
    ctx.provide('workspaces', { startSession } as never)
    const listeners: Array<(action: string) => void> = []
    const unsubscribe = vi.fn()
    const api: DesktopMenuApi = { onAction: (listener) => { listeners.push(listener); return unsubscribe } }
    ;(globalThis as { dshDesktop?: unknown }).dshDesktop = { menu: api }
    try {
      const fiber = ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      listeners[0]!('new-session')
      expect(startSession).toHaveBeenCalledOnce()
      listeners[0]!('other')
      expect(startSession).toHaveBeenCalledOnce()
      await fiber.dispose()
      expect(unsubscribe).toHaveBeenCalledOnce()
    } finally {
      delete (globalThis as { dshDesktop?: unknown }).dshDesktop
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
