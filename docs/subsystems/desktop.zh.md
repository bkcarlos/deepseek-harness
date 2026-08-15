# 桌面传输桥

[English](desktop.md) | 中文

[dsh-host-desktop](../../packages/host/desktop) 是 GUI 宿主的 Electron 桌面载体：一个 Cordis 服务，在已启动的树之上提供 `ctx.desktop` 这个与载体无关的桥。Electron 的 `ipcMain` 接线不属于本包——`apps/desktop` 外壳负责把服务的 `graph()`、`bundle()`、`fetch()` 结果通过 IPC 序列化给渲染进程的 `IpcApiClient`（[分层笔记](../../.agents/notes/implemented/architecture/2026-08-14-electron-desktop-ipc-surface.md)）。它除了客户端模块图和共享的 `/api` 网关之外不了解任何 harness 概念；渲染进程与浏览器加载同一套 GUI 阵容，只有物理通道不同。

源码：[`packages/host/desktop/src/index.ts`](../../packages/host/desktop/src/index.ts)

## 服务

`DesktopHostService`（`ctx.desktop`）基于三个已就绪的服务构建：`ctx.apiProxy`（Typert 网关）、`ctx.clientModules`（组合出的启动图与包字节）、`ctx.connection`（宿主 RPC 注册表）。`fetch(request)` 复用 `HostConnectionService.createSharedFetchHandler(API_PATH, toFetchHandler(ctx.apiProxy))`，因此 Typert Remote 拦截器组合进共享 `/api` 处理器的方式与 HTTP 路径完全一致。这里没有网络信任栅栏：同一台机器上的 IPC 渲染进程天然按 loopback 受信，所以 `trustedHosts` 字面量为空，且 `connection` 行不携带 `webRuntime` 注入。

该服务只负责传输。它不承担 agent-loop 角色，也不是能力 seam；渲染进程读取与 HTTP 载体完全相同的 `__DSH_BOOT__` 图和相同的 SSE `Response`，因此客户端的 `readSse` 路径保持不变。各包的操作细节（包括 `apps/desktop` 外壳接线）留在 [README](../../packages/host/desktop/README.md)。

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
