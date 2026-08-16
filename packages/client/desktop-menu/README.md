# @deepseek-ai/dsh-client-desktop-menu

Desktop-only renderless client plugin that dispatches the Electron native menu bar's commands to the client services. The menu (built in the desktop shell's main process) sends action strings over `window.dshDesktop.menu.onAction`; this plugin subscribes and routes `new-session` to `ctx.workspaces.startSession()`.

## Model Experience

None. This plugin dispatches a UI action; it contributes no model-visible input and writes nothing to the session log.

## Known Limitations and Deferred Work

- **One action today.** Only `new-session` is wired; future menu commands (open settings, open a workspace directory) add one branch in the same subscription rather than a second listener.
