/**
 * Desktop profile boot: compose the `desktop` profile (dsh-base + dsh-web-app
 * + dsh-desktop-app) and mount it in-process, mirroring the CLI's profile boot
 * without the signal handlers or the HTTP URL announcement. The settled tree
 * carries `ctx.desktop` (the desktop transport bridge) and `ctx.clientModules`;
 * the Electron main wires those over the IPC bridge this module's caller owns.
 * @module @deepseek-ai/dsh-desktop/boot
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import {
  boot,
  composeEntries,
  healProfilesModuleFallback,
  installFailLoud,
  loadOptionalPatches,
  loadProfile,
  PROFILE_PATCH_FILENAME,
} from '@deepseek-ai/dsh-app-boot'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** This app's bin name (diagnostic prefix for boot/loader failures). */
const NAME = 'dsh-desktop'

/** Absolute path of this desktop app's package.json (the boot anchor). */
export const INSTALL_ANCHOR = fileURLToPath(new URL('../package.json', import.meta.url))

/** Shipped agent-preset root: beside this app's own config, in both source and built layouts. */
const SHIPPED_PRESET_ROOT = fileURLToPath(new URL('../config/agent-presets/', import.meta.url))

/** The session-telemetry row id the DSH_TELEMETRY_DISABLED switch targets. */
const TELEMETRY_ROW_ID = 'session-telemetry-otel'

/** Root config filename inside the profile directory. */
const PROFILE_ROOT_FILENAME = 'cordis.yml'

/** The empty root entry list every profile tree patches over. */
const PROFILE_ROOT_CONFIG = `# dsh desktop profile root — an empty entry list.
[]
`

/**
 * Boot the `desktop` profile end to end and return the settled root context.
 * Mirrors the CLI's profile boot: heal the module fallback, rewrite the empty
 * root, stack bundle layers + profile/home patches + the shipped-preset root
 * and telemetry overlays, then mount and settle the tree.
 * @returns the settled root context carrying `ctx.desktop`.
 */
export async function bootDesktop(): Promise<Context> {
  healProfilesModuleFallback(INSTALL_ANCHOR)
  const profile = loadProfile(NAME, 'desktop', INSTALL_ANCHOR)
  const rootConfig = join(profile.dir, PROFILE_ROOT_FILENAME)
  writeFileSync(rootConfig, PROFILE_ROOT_CONFIG)

  const homePatches = loadOptionalPatches(NAME, join(resolveDshHome(), PROFILE_PATCH_FILENAME)) ?? []
  const bundlePatches = profile.layers.flatMap(layer => layer.patches)
  const rows = new Map<string, EntryOptions>()
  for (const row of composeEntries([bundlePatches, profile.patches, homePatches])) {
    if (typeof row.id === 'string') rows.set(row.id, row)
  }

  const overlays: PatchOptions[] = []
  // The shipped agent-preset root is an assembly fact beside this app's own
  // config, resolved only here (the writable root stays the presets package's).
  if (rows.has('agent-presets')) {
    overlays.push({
      id: 'agent-presets',
      config: {
        ...(rows.get('agent-presets')?.config ?? {}) as Record<string, unknown>,
        roots: [{ path: SHIPPED_PRESET_ROOT, trust: 'system' }],
      },
    })
  }
  if ((process.env.DSH_TELEMETRY_DISABLED ?? '') !== '' && rows.has(TELEMETRY_ROW_ID)) {
    overlays.push({ id: TELEMETRY_ROW_ID, disabled: true })
  }

  installFailLoud(NAME, process)
  return await boot(NAME, rootConfig, [...bundlePatches, ...profile.patches, ...homePatches, ...overlays])
}
