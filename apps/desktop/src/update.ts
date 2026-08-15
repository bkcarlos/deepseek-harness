/** Update-state vocabulary and IPC channel names shared by the desktop main, preload, and renderer surfaces.
 * @module @deepseek-ai/dsh-desktop/update
 */

/** The renderer-facing update lifecycle the main process drives from electron-updater. */
export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'not-available'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

/** IPC channels: invoke (check/install/state) and the main→renderer push (event). */
export const UPDATE_CHANNEL = {
  check: 'dsh:update:check',
  install: 'dsh:update:install',
  state: 'dsh:update:state',
  event: 'dsh:update:event',
} as const
