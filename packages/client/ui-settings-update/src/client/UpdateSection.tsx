/** The desktop update page: current status, download progress, and actions. */
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UpdateSectionInjected } from './index.ts'
import type { UpdateState } from './update-source.ts'
import css from './UpdateSection.module.css'

/** Full component props assembled by the Settings slot renderer. */
export type UpdateSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.update'>
  & InjectFace<UpdateSectionInjected>

/** Whether the manual check action is usable from this state. */
function canCheck(state: UpdateState): boolean {
  return state.phase !== 'checking' && state.phase !== 'downloading'
}

/** The localized status line for one state. */
function statusText(state: UpdateState, t: UpdateSectionProps['t']): string {
  switch (state.phase) {
    case 'idle': return t('idle')
    case 'checking': return t('checking')
    case 'available': return t('available', { version: state.version })
    case 'not-available': return t('notAvailable', { version: state.version })
    case 'downloading': return t('downloading', { version: state.version })
    case 'downloaded': return t('downloaded', { version: state.version })
    case 'error': return t('error', { message: state.message })
  }
}

/** Render the desktop update status, progress, and actions. */
export function UpdateSection({ useUpdate, check, install, t }: UpdateSectionProps): ReactNode {
  const state = useUpdate(s => s)
  const downloading = state.phase === 'downloading'
  return (
    <div className={css.section}>
      <p className={css.status} role="status">{statusText(state, t)}</p>
      {downloading && (
        <div
          className={css.progress}
          role="progressbar"
          aria-label={t('downloading', { version: state.version })}
          aria-valuenow={Math.round(state.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={css.progressBar} style={{ width: String(state.percent) + '%' }} />
        </div>
      )}
      <div className={css.actions}>
        <Button variant="outline" disabled={!canCheck(state)} onClick={check}>{t('check')}</Button>
        {state.phase === 'downloaded' && (
          <Button variant="primary" onClick={install}>{t('install')}</Button>
        )}
      </div>
    </div>
  )
}
