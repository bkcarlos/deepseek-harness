// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UpdateSection, type UpdateSectionProps } from '../src/client/UpdateSection.tsx'
import type { UpdateState } from '../src/client/update-source.ts'

afterEach(cleanup)

const t = ((key: string, params?: Record<string, string | number>) =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`) as UpdateSectionProps['t']

function renderSection(state: UpdateState) {
  const check = vi.fn()
  const install = vi.fn()
  const useUpdate = ((selector: (s: UpdateState) => unknown) => selector(state)) as never
  render(<UpdateSection useUpdate={useUpdate} check={check} install={install} t={t} />)
  return { check, install }
}

describe('UpdateSection', () => {
  it('renders the idle status and an enabled check button with no install action', () => {
    const { check } = renderSection({ phase: 'idle' })
    expect(screen.getByRole('status').textContent).toBe('idle')
    const button = screen.getByRole('button', { name: 'check' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(screen.queryByRole('button', { name: 'install' })).toBeNull()
    fireEvent.click(button)
    expect(check).toHaveBeenCalledOnce()
  })

  it('disables check while checking', () => {
    renderSection({ phase: 'checking' })
    expect(screen.getByRole('status').textContent).toBe('checking')
    expect((screen.getByRole('button', { name: 'check' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the available version with an enabled check button', () => {
    renderSection({ phase: 'available', version: '1.0.0' })
    expect(screen.getByRole('status').textContent).toContain('1.0.0')
    expect((screen.getByRole('button', { name: 'check' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows the up-to-date version', () => {
    renderSection({ phase: 'not-available', version: '1.0.0' })
    expect(screen.getByRole('status').textContent).toContain('1.0.0')
    expect((screen.getByRole('button', { name: 'check' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows download progress and disables check', () => {
    renderSection({ phase: 'downloading', version: '1.0.0', percent: 45 })
    expect(screen.getByRole('status').textContent).toContain('1.0.0')
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('45')
    expect((screen.getByRole('button', { name: 'check' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'install' })).toBeNull()
  })

  it('shows the downloaded version and offers install', () => {
    const { install } = renderSection({ phase: 'downloaded', version: '1.0.0' })
    expect(screen.getByRole('status').textContent).toContain('1.0.0')
    const installButton = screen.getByRole('button', { name: 'install' })
    fireEvent.click(installButton)
    expect(install).toHaveBeenCalledOnce()
  })

  it('shows the error message with an enabled retry', () => {
    renderSection({ phase: 'error', message: 'boom' })
    expect(screen.getByRole('status').textContent).toContain('boom')
    expect((screen.getByRole('button', { name: 'check' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
