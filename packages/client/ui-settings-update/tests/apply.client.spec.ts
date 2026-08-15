import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, type UpdateSectionInjected } from '../src/client/index.ts'
import { UpdateSection } from '../src/client/UpdateSection.tsx'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { 'settings.section': { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
}

function updateEntry(slots: SlotRegistry) {
  return slots.entries('settings.section').find(entry => entry.component === UpdateSection)
}

describe('ui-settings-update apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('registers the update section before or after the declaration, and leaves with its fiber', async () => {
    const before = await bench()
    declare(before.slots)
    await before.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = updateEntry(before.slots)!
    expect(entry.options).toMatchObject({ id: 'update', order: 100 })
    expect(resolveSlotLabel(entry.options.label)).toBe('更新')
    expect(entry.locale).toBe('settings.update')
    const injected = (entry.inject as unknown as () => UpdateSectionInjected)()
    expect(injected.hooks.update.getSnapshot()).toEqual({ phase: 'idle' })
    expect(injected.check).toEqual(expect.any(Function))
    expect(injected.install).toEqual(expect.any(Function))
    await before.ctx.fiber.dispose()
    expect(before.slots.entries('settings.section')).toHaveLength(0)

    const after = await bench()
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    expect(after.slots.entries('settings.section')).toHaveLength(0)
    declare(after.slots)
    await Promise.resolve()
    expect(updateEntry(after.slots)).toBeDefined()
  })

  it('registers the zh/en dictionaries and frees them on teardown', async () => {
    const b = await bench()
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.locale.bind('settings.update')('check')).toBe('检查更新')
    b.locale.setLocale('en')
    expect(b.locale.bind('settings.update')('check')).toBe('Check for updates')
    b.locale.setLocale('zh')
    await fiber.dispose()
    expect(() => b.locale.register('settings.update', 'zh', {})).not.toThrow()
    expect(() => b.locale.register('settings.update', 'en', {})).not.toThrow()
  })

  it('swallows a rejecting check from the bridge', async () => {
    const check = vi.fn(async () => { throw new Error('no updates') })
    const install = vi.fn(async () => {})
    ;(globalThis as { dshDesktop?: unknown }).dshDesktop = { updates: { check, install, getState: async () => ({ phase: 'idle' }), onEvent: () => () => {} } }
    try {
      const b = await bench()
      declare(b.slots)
      await b.ctx.plugin({ inject: [...inject], apply }).await()
      const entry = updateEntry(b.slots)!
      const injected = (entry.inject as unknown as () => UpdateSectionInjected)()
      injected.check()
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(check).toHaveBeenCalledOnce()
    } finally {
      delete (globalThis as { dshDesktop?: unknown }).dshDesktop
    }
  })

  it('drives the desktop bridge through the injected actions', async () => {
    const check = vi.fn(async () => {})
    const install = vi.fn(async () => {})
    const getState = vi.fn(async () => ({ phase: 'idle' }) as const)
    ;(globalThis as { dshDesktop?: unknown }).dshDesktop = { updates: { check, install, getState, onEvent: () => () => {} } }
    try {
      const b = await bench()
      declare(b.slots)
      await b.ctx.plugin({ inject: [...inject], apply }).await()
      const entry = updateEntry(b.slots)!
      const injected = (entry.inject as unknown as () => UpdateSectionInjected)()
      injected.check()
      injected.install()
      expect(check).toHaveBeenCalledOnce()
      expect(install).toHaveBeenCalledOnce()
    } finally {
      delete (globalThis as { dshDesktop?: unknown }).dshDesktop
    }
  })
})
