# @deepseek-ai/dsh-client-desktop-menu

English | [中文](README.zh.md)

Desktop-only renderless client plugin that dispatches the Electron native menu bar's commands to the client services. The menu (built in the desktop shell's main process) sends action strings over `window.dshDesktop.menu.onAction`; this plugin subscribes and routes `new-session` to `ctx.workspaces.startSession()`.

## Model Experience

None, as this plugin dispatches UI actions without contributing model-visible input or writing to the session log.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Renderer-owned commands require their feature plugin.** An action routed through `desktop/menu` has no effect when its owning client plugin is absent.
