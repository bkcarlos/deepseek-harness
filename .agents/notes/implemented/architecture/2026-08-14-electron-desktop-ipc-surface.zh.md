# Agent Note：Electron 桌面形态 —— 共享 web GUI 阵容之上的 IPC fetch 载体与桌面传输桥接

Status: implemented

[English](2026-08-14-electron-desktop-ipc-surface.md) | 中文

> 分工：本文 = 桌面形态的传输与组合；共享的 client/host 分层与四象限消息模型见 [GUI 分层与 RPC 协议](2026-07-19-gui-layering-and-rpc-protocol.md)，浏览器对象层见 [web client 架构说明](2026-07-19-gui-web-client-architecture.md)。

## 问题

Web 形态运行 `dsh --profile web`：一个回环 `node:http` 服务器提供构建好的前端，并桥接 `/api` 与两条 WebSocket 下行流。可安装的桌面应用需要在原生窗口里呈现同样的 GUI，却不依赖该 HTTP 服务器——正如 [webserver README](../../../../packages/host/webserver/README.md) 预留的：Electron 通过 `file://` 加载 dist，并经 IPC 桥接承载 fetch。客户端插件 bundle（`/plugins/<id>/client.js`）与 `__DSH_BOOT__` 的 index 注入是 web 服务器的路由与 tap，因此没有服务器的桌面形态必须以另一种方式提供它们。

## 决策

桌面形态是既有 GUI 之上的传输层替换，而不是第二个 GUI：

- **客户端载体** —— [`dsh-client-connection`](../../../../packages/client/connection/README.md) 中的 `IpcApiClient` 继承 `AbstractApiClient`，只覆写 `doFetch`，与 `InProcessApiClient` 完全一致。它读取的 `DesktopFetchBridge` 是推块通道：一次 `request()` 返回头部 promise（status/headers）加上 `onChunk`/`onEnd`/`onError`，`cancel()` 拆除请求。unary 与 SSE 都经重建出的 `Response` 走 `doFetch`，因此所有协议不变量（rpcId、信封包裹/解包、zod 解析、SSE 解码、unary 超时）都留在基类。插件主体在 `globalThis.dshDesktop` 存在时选择该载体，并把该载体视为 loopback。`createIpcConnectionRpc` 是同一选择下走桥接的 RPC 调用方。
- **宿主桥接** —— [`dsh-host-desktop`](../../../../packages/host/desktop/README.md) 中的 `DesktopHostService` 提供 `ctx.desktop`：`graph()`（组合出的 `__DSH_BOOT__`）、`bundle(id)`（某个客户端 bundle 的字节）、`fetch(request)`（经 `HostConnectionService.createSharedFetchHandler(API_PATH, toFetchHandler(ctx.apiProxy))`）。它复用 `client-connection` 节点半提供的宿主 RPC 注册表，因此 Typert Remote 拦截器与 HTTP 组合方式一致。这里没有网络信任栅栏：同机、进程内的 IPC renderer 天然即 loopback 受信。
- **与载体无关的解耦** —— `ClientModuleRegistry`（`dsh-client-modules`）不再注入 `webServer`：图扫描与 `clientPath()` 与载体无关，bundle 路由与 index tap 只在存在 web 服务器时挂载。`client-connection` 节点半同样不再注入 `webServer`：它始终提供 `ctx.connection`（宿主 RPC 注册表），其 HTTP 路由与 WebSocket 下行流只在存在 web 服务器时挂载。正是这一点让桌面组合能够禁用 `webserver` 而不致某个 pending entry 触发启动审计失败。
- **组合** —— `dsh-desktop-app` 是叠加在 `dsh-web-app`（后者又叠加在 `dsh-base`）之上的组合包：它禁用 `webserver`/`web-runtime`/`web-startup`/`client-hmr`，清空 `connection` 行的 `webRuntime` 注入（`inject: []` —— `inject` 是行字段，不是 `config` 键）与 LAN 信任字面量，把 `directory-picker` 行从依赖 web 服务器的 `-auto` 选择器换成 `-native`（patch 只会校验行的 `name`，因此禁用 auto 行、以自身 id 挂载 native 提供方），并挂载 `desktop` 行。`desktop` profile 模板列出 `[dsh-base, dsh-web-app, dsh-desktop-app]`。
- **壳层** —— `apps/desktop` 是 Electron 应用：主进程在进程内启动 `desktop` profile，经 `ipcMain` 接线 `ctx.desktop`（启动 manifest、bundle 字节、以及把 `Response` 正文块流回的流式 fetch），并打开一个经 `file://` 加载构建产物的 `BrowserWindow`。preload 暴露 `window.dshDesktop`；renderer bootstrap 从桥接组装 `__DSH_BOOT__`，并交给壳层一个在页内执行 bundle 字节的 `loadBundle` 缝。`electron-builder` 打包 `dmg`/`zip`（macOS）、`nsis`（Windows）与 `AppImage`/`deb`（Linux）。
- **打包** —— `electron-builder` 以 `asar: false` 运行，因为启动复用 CLI 的 profile 机制，其 `healProfilesModuleFallback` 把 `$DSH_HOME/profiles/node_modules` 软链到应用的依赖树，Loader 再经这些真实路径解析裸插件名——指向 asar 路径的软链无法被导入。`apps/desktop` 还把工作区的 peer 依赖闭包（只经 `peerDependencies` 可达的 `dsh-*` 包，如 `dsh-timeout`/`dsh-scope`）声明为直接依赖，因为 electron-builder 沿 `dependencies` 图走，却不复刻 pnpm 每包的 peer 软链。

## 后果

浏览器与桌面形态共享同一 GUI 阵容、同一 API 契约；只有物理通道不同。桌面 renderer 是同一 `dsh-client-web` 壳层之上的一个薄入口，因此它自身不做任何组合决策。桌面组合里没有 HTTP 服务器；桥接流式传输的是 HTTP 载体发出的同一条 SSE `Response`，因此客户端的 `readSse` 路径无需改动。

## 已考虑的替代方案

| 被否方案 | 一句话理由 |
|---|---|
| 内嵌 HTTP 服务器并在 webview 中加载 `http://localhost` | 重新引入桌面应用本不需要的 loopback 绑定与 LAN 信任栅栏；IPC 桥接以零网络暴露维持同一 `Response` 契约 |
| 第二个、Electron 原生的 GUI 重实现整套阵容 | 复制每一个 `dsh.client` 行与壳层；传输层替换可复用整套 web 阵容 |
| `asar: true` 打包 | `healProfilesModuleFallback` 把 `$DSH_HOME/profiles/node_modules` 软链到真实路径，指向 asar 路径的软链无法被导入 |

## 验证

- `packages/client/connection/tests/ipc-api-client.client.spec.ts` 以脚本化桥接驱动 `IpcApiClient`（unary 往返、SSE 流、abort 语义、RPC 关联）。
- `packages/host/desktop/tests/desktop.spec.ts` 以真实 `HostConnectionService` + 桩 `ApiProxy` 驱动 `DesktopHostService`（图、bundle 字节、unary fetch、SSE 正文）。
- 既有的 `node-half` 与 `client-apply` 套件覆盖解耦后的 `webServer` 挂载与载体选择。
- 打包后的应用被端到端启动：`bootDesktop()` 稳定时 `ctx.desktop`、`ctx.clientModules`、`ctx.apiProxy` 均在，启动的 `.app` 拉起 main/GPU/network/renderer 进程且无启动错误。
