# @deepseek-ai/dsh-desktop-app

English | [中文](README.zh.md)

The dsh Electron desktop-surface bundle. [`cordis.patch.yml`](cordis.patch.yml) rides over [`dsh-web-app`](../web-app/README.md) (which itself rides over [`dsh-base`](../base/README.md)): it keeps the whole GUI roster — the host services and every `dsh.client` row — and swaps only the transport. The HTTP rows (`webserver`, `web-runtime`, `web-startup`, `client-hmr`) are disabled, the `connection` row drops its web-only `webRuntime` injection and LAN trust literals, and one row mounts the [`dsh-host-desktop`](../../host/desktop/README.md) bridge, which provides `ctx.desktop` (boot graph, bundle bytes, fetch-shaped gateway) over the desktop IPC carrier.

The profile stacks `dsh-base`, `dsh-web-app`, then this bundle; the `apps/desktop` shell boots that composition, loads the built [`dsh-web-frontend`](../../../apps/web/README.md) dist over `file://`, and bridges the gateway through the Electron IPC instead of an HTTP server. The agent-plane rows stay exactly as the web surface leaves them (agent presets own the per-session toolset); only the transport differs.

## Model Experience

### Harness-source and desktop-surface context

The surface is identical to the web surface except for its transport: the persona comes from the shared `system-prompt` row, and the shell's own boot can attach a desktop-surface prompt section when it is wired. This bundle adds no model-visible text of its own.

#### Token effect

None directly; a desktop-surface prompt section the shell registers is constant per process.

#### KV Cache effect

None directly; any shell-registered surface section sits near the system prompt's head and is stable for the process lifetime.

## Known Limitations and Deferred Work

- **No desktop-surface prompt section** — the shell does not yet register a `app:desktop-surface` section orienting the model to the native window; the shared web persona still names the model without a GUI referent.
- **No client-bundle HMR** — bundle bytes load over the IPC bridge once per boot; live client-plugin reload is a web-only chain and is disabled here.
