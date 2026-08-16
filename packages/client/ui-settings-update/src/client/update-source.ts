/**
 * The desktop update bridge face (structurally typed — the renderer reads the
 * window.dshDesktop.updates the Electron preload exposes) and the observable
 * source that turns its push events into a HostObservable for the section.
 */

import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/** Update lifecycle state mirrored from the Electron main process. */
export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'not-available'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'restarting' }
  | { phase: 'error'; message: string }

/** The preload-exposed update surface (a subset of window.dshDesktop). */
export interface DesktopUpdatesApi {
  check(): Promise<unknown>
  install(): Promise<unknown>
  getState(): Promise<UpdateState>
  onEvent(listener: (state: UpdateState) => void): () => void
}

/**
 * Read the desktop update surface.
 * @returns the preload API, or undefined in a plain web surface.
 */
export function readDesktopUpdates(): DesktopUpdatesApi | undefined {
  const value = (globalThis as { dshDesktop?: { updates?: DesktopUpdatesApi } }).dshDesktop
  return value?.updates
}

/**
 * Build the update state source. With no desktop bridge the source is a
 * permanent idle — the section still renders its copy but its actions no-op.
 * With a bridge it seeds from getState and republishes every push, keeping
 * getSnapshot identity-stable between changes.
 * @param updates - the preload bridge, when present.
 * @returns a bare observable source the renderer binds as useUpdate.
 */
export function createUpdateSource(updates: DesktopUpdatesApi | undefined): HostObservable<UpdateState> {
  if (updates === undefined) {
    return { getSnapshot: () => ({ phase: 'idle' }), subscribe: () => () => {} }
  }
  let state: UpdateState = { phase: 'idle' }
  const listeners = new Set<() => void>()
  const publish = (next: UpdateState): void => {
    state = next
    for (const listener of listeners) listener()
  }
  void updates.getState().then(publish, () => {})
  updates.onEvent(publish)
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
