/**
 * The desktop bundle is a static patch carrier (its substance is
 * `cordis.patch.yml`); the only runtime face is the invariant companion, so
 * these specs prove it registers a no-op installer under its package name.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply, inject, name } from '../src/invariant.ts'

describe('desktop-app bundle invariant companion', () => {
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
    expect(name).toBe('desktop-app-bundle-invariant')
    expect(inject).toEqual(['invariants'])
    await expect(apply(ctx)).resolves.toBe(disposer)
    expect(registered).toHaveLength(1)
    expect(registered[0]?.[0]).toBe('@deepseek-ai/dsh-desktop-app')
    registered[0]?.[1]()
  })
})
