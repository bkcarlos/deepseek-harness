# Desktop Transport Bridge

English | [中文](desktop.zh.md)

[dsh-host-desktop](../../packages/host/desktop) is the Electron desktop carrier for the GUI host: a single Cordis service providing `ctx.desktop`, the carrier-agnostic bridge over the already-booted tree. The Electron `ipcMain` wiring is not this package — the `apps/desktop` shell serializes the service's `graph()`, `bundle()`, and `fetch()` results over IPC to the renderer's `IpcApiClient` ([layering note](../../.agents/notes/implemented/architecture/2026-08-14-electron-desktop-ipc-surface.md)). It knows no harness concepts beyond the client-modules graph and the shared `/api` gateway; the renderer and the browser load the same GUI roster, and only the physical channel differs.

Source: [`packages/host/desktop/src/index.ts`](../../packages/host/desktop/src/index.ts)

## The service

`DesktopHostService` (`ctx.desktop`) is constructed over three settled services: `ctx.apiProxy` (the Typert gateway), `ctx.clientModules` (the composed boot graph and bundle bytes), and `ctx.connection` (the host RPC registry). `fetch(request)` reuses `HostConnectionService.createSharedFetchHandler(API_PATH, toFetchHandler(ctx.apiProxy))`, so Typert Remote interceptors compose into the shared `/api` handler identically to the HTTP path. There is no network trust fence: an IPC renderer on the same machine is loopback-trusted by construction, so the `trustedHosts` literal is empty and the connection row carries no `webRuntime` injection.

The service is transport-only. It serves no agent-loop role and no capability seam; the renderer reads the same `__DSH_BOOT__` graph and the same SSE `Response` the HTTP carrier emits, so the client's `readSse` path is untouched. Per-package operational detail, including the `apps/desktop` shell wiring, stays in the [README](../../packages/host/desktop/README.md).

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxdesktop--desktophostservice"></a>

### `ctx.desktop` — `DesktopHostService`

The desktop host service: the boot-manifest graph, per-entry bundle bytes, and the fetch-shaped API gateway (unary plus SSE streams) the Electron shell bridges over IPC. Provides `ctx.desktop` and `ctx.connection` (the host RPC registry `api-remotes` intercepts).

```ts cordis-catalog
/**
 * The composed client entry graph (what the browser reads as `window.__DSH_BOOT__`).
 * @returns the client-modules boot manifest.
 */
graph(): WebBootGraph

/**
 * Bundle bytes for a client entry id, read from the client-modules table.
 * @param id - client entry name (package name).
 * @returns the bundle content, or undefined for an unknown id.
 */
bundle(id: string): DesktopBundleContent | undefined

/**
 * Fetch-shaped API transport: unary and respond are complete JSON bodies;
 * the event streams return an SSE Response whose body the shell streams.
 * @param request - the reconstructed request (fake authority, routed by pathname).
 * @returns the host's response.
 */
fetch(request: Request): Promise<Response>
```

Types: [WebBootGraph](client-modules.md)

Source: [`packages/host/desktop/src/index.ts:44`](../../packages/host/desktop/src/index.ts)
<!-- END GENERATED cordis-surface -->
