# Agent Note: Electron desktop surface — the IPC fetch carrier and the desktop transport bridge over the shared web GUI roster

Status: implemented

English | [中文](2026-08-14-electron-desktop-ipc-surface.zh.md)

> Division of labor: this document = the desktop surface's transport and composition; the shared client/host layering and the four-quadrant message model are in [GUI layering and the RPC protocol](2026-07-19-gui-layering-and-rpc-protocol.md), and the browser object layer is in the [web client architecture note](2026-07-19-gui-web-client-architecture.md).

## Problem

The web surface runs `dsh --profile web`: a `node:http` server on loopback serves the built frontend and bridges `/api` plus two WebSocket downlinks. An installable desktop app needs the same GUI in a native window without that HTTP server, per the reservation in the [webserver README](../../../packages/host/webserver/README.md): Electron loads dist over `file://` and carries fetch over an IPC bridge. The client plugin bundles (`/plugins/<id>/client.js`) and the `__DSH_BOOT__` index injection are web-server routes and taps, so a desktop surface without the server must supply those another way.

## Decision

The desktop surface is a transport swap over the existing GUI, not a second GUI:

- **Client carrier** — `IpcApiClient` (in [`dsh-client-connection`](../../../packages/client/connection/README.md)) subclasses `AbstractApiClient` and overrides only `doFetch`, exactly like `InProcessApiClient`. The `DesktopFetchBridge` it reads is a push-chunk channel: one `request()` returns a head promise (status/headers) plus `onChunk`/`onEnd`/`onError`, and `cancel()` tears the request down. Unary and SSE both ride `doFetch` through the reconstructed `Response`, so every protocol invariant (rpcId, envelope wrap, zod parse, SSE decode, unary timeout) stays in the base class. The plugin body selects it when `globalThis.dshDesktop` is present, and treats that carrier as loopback. `createIpcConnectionRpc` is the same selection's RPC caller over the bridge.
- **Host bridge** — `DesktopHostService` (in [`dsh-host-desktop`](../../../packages/host/desktop/README.md)) provides `ctx.desktop`: `graph()` (the composed `__DSH_BOOT__`), `bundle(id)` (one client bundle's bytes), and `fetch(request)` over `HostConnectionService.createSharedFetchHandler(API_PATH, toFetchHandler(ctx.apiProxy))`. It reuses the host RPC registry the `client-connection` node half provides, so Typert Remote interceptors compose identically to HTTP. There is no network trust fence: an IPC renderer on the same machine is loopback-trusted by construction.
- **Carrier-agnostic decoupling** — `ClientModuleRegistry` (`dsh-client-modules`) no longer injects `webServer`: the graph scan and `clientPath()` are carrier-agnostic, and the bundle route + index tap mount only when a web server is present. The `client-connection` node half likewise no longer injects `webServer`: it always provides `ctx.connection` (the host RPC registry), and its HTTP route + WebSocket downlinks mount only with a web server. This is what lets the desktop composition disable `webserver` without a pending entry failing the boot audit.
- **Composition** — `dsh-desktop-app` is a bundle layered over `dsh-web-app` (which layers over `dsh-base`): it disables `webserver`/`web-runtime`/`web-startup`/`client-hmr`, clears the `connection` row's `webRuntime` injection (`inject: []` — `inject` is a row field, not a `config` key) and LAN trust literals, swaps the `directory-picker` row from the web-server-bound `-auto` chooser to `-native` (a patch validates a row's `name`, so the auto row is disabled and the native provider mounted under its own id), and mounts the `desktop` row. The profile `desktop` template lists `[dsh-base, dsh-web-app, dsh-desktop-app]`.
- **Shell** — `apps/desktop` is the Electron app: the main process boots the `desktop` profile in-process, wires `ctx.desktop` over `ipcMain` (boot manifest, bundle bytes, and a streaming fetch that pushes `Response` body chunks back), and opens one `BrowserWindow` loading the built renderer over `file://`. The preload exposes `window.dshDesktop`; the renderer bootstrap composes `__DSH_BOOT__` from the bridge and hands the shell a `loadBundle` seam that executes bundle bytes in-page. `electron-builder` packages `dmg`/`zip` (macOS), `nsis` (Windows), and `AppImage`/`deb` (Linux).
- **Packaging** — `electron-builder` runs with `asar: false` because the boot reuses the CLI's profile machinery, whose `healProfilesModuleFallback` symlinks `$DSH_HOME/profiles/node_modules` onto the app's dependency tree and the Loader resolves bare plugin names through those real paths — a symlink into an asar path is not importable. `apps/desktop` also declares the workspace's peer-dependency closure (the `dsh-*` packages reachable only through `peerDependencies`, e.g. `dsh-timeout`/`dsh-scope`) as direct dependencies, because electron-builder follows the `dependencies` graph but does not replicate pnpm's per-package peer symlinks.

## Consequences

The browser and desktop surfaces share one GUI roster and one API contract; only the physical channel differs. The desktop renderer is a separate thin entry over the same `dsh-client-web` shell, so it composes zero decisions itself. The HTTP server is absent from the desktop composition; the bridge streams the same SSE `Response` the HTTP carrier emits, so the client's `readSse` path is untouched.

## Verification

- `packages/client/connection/tests/ipc-api-client.spec.ts` drives `IpcApiClient` over a scripted bridge (unary round-trip, SSE streaming, abort semantics, RPC correlation).
- `packages/host/desktop/tests/desktop.spec.ts` drives `DesktopHostService` over a real `HostConnectionService` + a stub `ApiProxy` (graph, bundle bytes, unary fetch, SSE body).
- The existing `node-half` and `client-apply` suites cover the decoupled `webServer` mounts and the carrier selection.
- The packaged app is booted end to end: `bootDesktop()` settles with `ctx.desktop`, `ctx.clientModules`, and `ctx.apiProxy` present, and the launched `.app` raises its main/GPU/network/renderer processes with no boot error.
