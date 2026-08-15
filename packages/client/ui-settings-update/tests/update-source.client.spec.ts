import { describe, expect, it, vi } from 'vitest'
import { createUpdateSource, readDesktopUpdates, type DesktopUpdatesApi, type UpdateState } from '../src/client/update-source.ts'

describe('readDesktopUpdates', () => {
  it('returns the preload update surface when present', () => {
    const api: DesktopUpdatesApi = {
      check: async () => {},
      install: async () => {},
      getState: async () => ({ phase: 'idle' }),
      onEvent: () => () => {},
    }
    ;(globalThis as { dshDesktop?: unknown }).dshDesktop = { updates: api }
    expect(readDesktopUpdates()).toBe(api)
    delete (globalThis as { dshDesktop?: unknown }).dshDesktop
  })

  it('returns undefined without a desktop bridge', () => {
    expect(readDesktopUpdates()).toBeUndefined()
  })
})

describe('createUpdateSource', () => {
  it('returns a permanent idle source without a bridge', () => {
    const source = createUpdateSource(undefined)
    expect(source.getSnapshot()).toEqual({ phase: 'idle' })
    const listener = vi.fn()
    const off = source.subscribe(listener)
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  it('seeds from getState and republishes push events', async () => {
    const eventListeners: Array<(state: UpdateState) => void> = []
    const api: DesktopUpdatesApi = {
      check: vi.fn(async () => {}),
      install: vi.fn(async () => {}),
      getState: vi.fn(async () => ({ phase: 'downloaded', version: '1.0.0' }) as UpdateState),
      onEvent: vi.fn((listener) => { eventListeners.push(listener); return () => {} }),
    }
    const source = createUpdateSource(api)
    expect(source.getSnapshot()).toEqual({ phase: 'idle' })
    const listener = vi.fn()
    source.subscribe(listener)
    await vi.waitFor(() => {
      expect(source.getSnapshot()).toEqual({ phase: 'downloaded', version: '1.0.0' })
    })
    expect(listener).toHaveBeenCalled()
    eventListeners[0]!({ phase: 'checking' })
    expect(source.getSnapshot()).toEqual({ phase: 'checking' })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stops notifying a removed listener', async () => {
    const eventListeners: Array<(state: UpdateState) => void> = []
    const api: DesktopUpdatesApi = {
      check: vi.fn(async () => {}),
      install: vi.fn(async () => {}),
      getState: vi.fn(async () => ({ phase: 'idle' }) as UpdateState),
      onEvent: vi.fn((listener) => { eventListeners.push(listener); return () => {} }),
    }
    const source = createUpdateSource(api)
    const listener = vi.fn()
    const off = source.subscribe(listener)
    off()
    eventListeners[0]!({ phase: 'checking' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores a getState rejection and keeps serving idle', async () => {
    const api: DesktopUpdatesApi = {
      check: vi.fn(async () => {}),
      install: vi.fn(async () => {}),
      getState: vi.fn(async () => { throw new Error('no state') }),
      onEvent: vi.fn(() => () => {}),
    }
    const source = createUpdateSource(api)
    await vi.waitFor(() => { expect(api.getState).toHaveBeenCalled() })
    expect(source.getSnapshot()).toEqual({ phase: 'idle' })
  })
})
