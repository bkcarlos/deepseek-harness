# @deepseek-ai/dsh-desktop

English | [中文](README.zh.md)

The Electron desktop shell for DeepSeek Harness. It boots the `desktop` profile (dsh-base + dsh-web-app + dsh-desktop-app) in-process, bridges the GUI over Electron IPC instead of an HTTP server, and packages a native installer.

- `src/main.ts` — main process: boot the tree, wire `ctx.desktop` over `ipcMain` (boot manifest, bundle bytes, a streaming fetch that pushes `Response` body chunks back), and open one `BrowserWindow` over `file://`.
- `src/preload.ts` — exposes `window.dshDesktop` (the `DesktopFetchBridge` the client `connection` plugin reads, plus the boot-manifest and bundle loaders).
- `src/renderer.ts` — the thin renderer entry: composes `__DSH_BOOT__` from the bridge and hands the shell a `loadBundle` seam that executes bundle bytes in-page.
- `src/boot.ts` — composes and boots the `desktop` profile, mirroring the CLI's profile boot.
- `src/update.ts` — shares the auto-update state and IPC channel names between the main process and preload.
- `src/menu.ts` — builds the native application menu and dispatches its app actions.

## Build and package

```sh
pnpm install
pnpm run build:lib                          # client bundles + vendored runtime + Typert contracts
pnpm --filter @deepseek-ai/dsh-desktop run dist   # vite + tsdown + electron-builder
```

Installers land in `release/` (`dmg`/`zip` on macOS, `exe` on Windows, `AppImage`/`deb` on Linux). Signing is off by default (`CSC_IDENTITY_AUTO_DISCOVERY=false` in CI); release builds add per-platform signing and notarization.

## Packaging invariants

Two electron-builder facts are load-bearing and must not be "simplified" away:

- **`asar: false`** — the boot reuses the CLI's profile machinery, whose `healProfilesModuleFallback` symlinks `$DSH_HOME/profiles/node_modules` onto the app's dependency tree and the Loader resolves bare plugin names through those real paths. A symlink into an asar path is not importable.
- **The dependency list is the workspace peer closure** — electron-builder follows the `dependencies` graph but does not replicate pnpm's per-package `peerDependencies` symlinks, so every `dsh-*` package reachable only through peers (e.g. `dsh-timeout`, `dsh-scope`) is declared here directly. Regenerate the closure when the tree changes (see the Agent Note in `.agents/notes/implemented/architecture/2026-08-14-electron-desktop-ipc-surface.md`).
- **Every local Electron process module is a tsdown entry** — tsdown emits and rewrites each entry to `.js`; an imported module omitted from the entry list remains a `.ts` import that the packaged app cannot load.

## Known Limitations

- **Unsigned development builds** — installers are unsigned; Gatekeeper/SmartScreen require signing + notarization for distribution.
- **arm64-only macOS output** — the default matrix builds the host architecture; x64 needs an explicit `arch` target.
