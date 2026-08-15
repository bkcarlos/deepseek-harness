# @deepseek-ai/dsh-desktop-app

English | [中文](README.zh.md)

The dsh Electron desktop-surface bundle. [`cordis.patch.yml`](cordis.patch.yml) rides over [`dsh-web-app`](../web-app/README.md) (which itself rides over [`dsh-base`](../base/README.md)): it keeps the whole GUI roster — the host services and every `dsh.client` row — and swaps only the transport. The HTTP rows (`webserver`, `web-runtime`, `web-startup`, `client-hmr`) are disabled, the `connection` row drops its web-only `webRuntime` injection and LAN trust literals, and one row mounts the [`dsh-host-desktop`](../../host/desktop/README.md) bridge, which provides `ctx.desktop` (boot graph, bundle bytes, fetch-shaped gateway) over the desktop IPC carrier.

The profile stacks `dsh-base`, `dsh-web-app`, then this bundle; the `apps/desktop` shell boots that composition, loads the built `@deepseek-ai/dsh-web-frontend` dist over `file://`, and bridges the gateway through the Electron IPC instead of an HTTP server. The agent-plane rows stay exactly as the web surface leaves them (agent presets own the per-session toolset); only the transport differs.

## Model Experience

Indirectly, through the inserted rows' own packages: this bundle is a patch-list carrier that disables the HTTP rows and mounts the desktop bridge over the shared web surface, and the persona, prompts, and tools stay owned by those composed rows.

#### KV Cache effect

None directly; the bundle neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No desktop-surface prompt section** — the shell does not yet register a `app:desktop-surface` section orienting the model to the native window; the shared web persona still names the model without a GUI referent.
- **No client-bundle HMR** — bundle bytes load over the IPC bridge once per boot; live client-plugin reload is a web-only chain and is disabled here.
