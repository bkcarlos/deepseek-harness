/**
 * Desktop update status Settings section: contributes an "Updates" page that
 * shows the electron-updater lifecycle (idle/checking/downloading/downloaded/
 * error), a manual "check for updates" action, and "restart to install" once
 * a build is downloaded. Desktop-only — composed only by the desktop bundle.
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { UpdateSection } from './UpdateSection.tsx'
import { createUpdateSource, readDesktopUpdates, type UpdateState } from './update-source.ts'
import { en, zh, type UpdateLocaleKey } from './locales.ts'

export type { UpdateState } from './update-source.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Desktop update section copy. */
    'settings.update': UpdateLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.update'

/** Injected face: the bound state hook plus the manual check/install actions. */
export interface UpdateSectionInjected {
  hooks: { update: HostObservable<UpdateState> }
  check: () => void
  install: () => void
}

/** Services required by the Settings registration. */
export const inject = ['slots', 'locale']

/** Contribute the desktop update page to the Settings section list. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-update: dictionaries')

  const t = ctx.locale.bind(NS)
  const updates = readDesktopUpdates()
  const source = createUpdateSource(updates)
  const injected = (): UpdateSectionInjected => ({
    hooks: { update: source },
    check: () => { void updates?.check().catch(() => {}) },
    install: () => { void updates?.install() },
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'update',
    order: 100,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, UpdateSection))
}
