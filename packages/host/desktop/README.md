# @deepseek-ai/dsh-host-desktop

English | [中文](README.zh.md)

Host-side transport bridge for the Electron desktop surface (default-exported `DesktopHostService`, no config): it provides `ctx.desktop` over the already-booted Cordis tree, exposing the three faces the `apps/desktop` shell serializes over its IPC bridge — `graph()` (the composed `window.__DSH_BOOT__` entry graph), `bundle(id)` (one client plugin bundle's bytes, `text/javascript`), and `fetch(request)` (the fetch-shaped API gateway: unary/respond JSON bodies plus the SSE event streams). It also provides `ctx.connection` by constructing the shared [`HostConnectionService`](../../client/connection/README.md), so [`dsh-api-remotes`](../../api/remotes/README.md) Typert Remote interceptors compose into the `/api` fetch handler exactly as they do over HTTP.

This package imports no Electron and no HTTP server: it is the carrier-agnostic face, and the `ipcMain` wiring — request serialization, streaming a `Response` body back as chunks, abort propagation — lives in the shell. The fetch handler reuses [`toFetchHandler(ctx.apiProxy)`](../../host/apiproxy/README.md) as the fallback under `HostConnectionService.createSharedFetchHandler(API_PATH, …)`, which routes interceptor-owned endpoints to the Typert gateway and everything else to the API proxy. Because the renderer runs in-process on the same machine, there is no network trust fence: an IPC call is loopback-trusted by construction, so the privileged method set that the HTTP path pins to loopback is equally available here.

## Model Experience

None, as the package is a transport bridge between the Electron renderer and the gateway other plugins provide; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The client bundles must be built** — `bundle(id)` reads the `lib/client.js` artifact each client-modules row resolves, and a missing artifact means the shell reports that package's boot failure rather than loading it.
- **No source-map serving** — the desktop renderer loads bundle bytes only; production source maps are not requested over the bridge.
- **`rpc.handle` remains web-server-bound** — the desktop surface uses only `rpc.intercept` (what `dsh-api-remotes` registers); a plugin calling `HostConnectionService.rpc.handle` would still expect a web server route and is not part of this surface.
