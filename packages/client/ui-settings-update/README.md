# @deepseek-ai/dsh-client-ui-settings-update

Desktop-only Settings section that surfaces the Electron auto-update lifecycle: current status (idle / checking / available / not-available / downloading / downloaded / error), download progress, a manual **Check for updates** action, and **Restart and install** once a build is downloaded.

The section reads the preload-exposed `window.dshDesktop.updates` bridge and contributes a `settings.section` entry (`id: update`), so it only renders meaningfully under the desktop bundle — a plain `dsh web` surface reports idle and its actions no-op.

## Model Experience

None. This plugin renders a status readout and buttons; it contributes no model-visible input and writes nothing to the session log.

## Known Limitations and Deferred Work

- **Update state is main-process-only.** The renderer mirrors whatever the Electron main pushes; on macOS the signature verification of an unsigned build fails at the updater, which the section reports as an `error` state rather than a download.
- **Progress is a single percentage.** electron-updater reports one percentage per `download-progress` event; bytes and transfer speed are available in the event but are not surfaced in this first pass.
