# @deepseek-ai/dsh-host-desktop

[English](README.md) | 中文

Electron 桌面形态的宿主侧传输桥接（默认导出的 `DesktopHostService`，无配置）：它在已启动的 Cordis 树上提供 `ctx.desktop`，暴露 `apps/desktop` 壳层经其 IPC 桥接序列化的三个面——`graph()`（组合出的 `window.__DSH_BOOT__` 配置项图）、`bundle(id)`（某个客户端插件 bundle 的字节，`text/javascript`）、`fetch(request)`（fetch 形态的 API 网关：unary/respond 的 JSON 正文加上 SSE 事件流）。它还通过构造共享的 [`HostConnectionService`](../../client/connection/README.md) 提供 `ctx.connection`，使 [`dsh-api-remotes`](../../api/remotes/README.md) 的 Typert Remote 拦截器像走 HTTP 时一样组合进 `/api` fetch 处理器。

本包不引入 Electron，也不引入 HTTP 服务器：它是与载体无关的面，`ipcMain` 接线——请求序列化、把 `Response` 正文以块流回、abort 传播——都放在壳层里。fetch 处理器以 [`toFetchHandler(ctx.apiProxy)`](../../host/apiproxy/README.md) 作为 `HostConnectionService.createSharedFetchHandler(API_PATH, …)` 之下的回退，把拦截器占有的端点路由到 Typert 网关，其余全部交给 API proxy。因为 renderer 与主机同机、进程内运行，这里没有网络信任栅栏：IPC 调用天然即 loopback 受信，所以 HTTP 路径钉在 loopback 上的特权方法集在此同样可用。

## 模型体验

无。本包只是 Electron renderer 与其他插件提供的网关之间的传输桥接；这里没有任何内容进入模型请求。

#### KV 缓存效果

无。本包既不组装也不发送 provider 请求。

## 已知限制与后续工作

- **客户端 bundle 必须先构建**——`bundle(id)` 读取每个 client-modules 行解析出的 `lib/client.js` 产物，产物缺失时壳层报告该包的启动失败而不是加载它。
- **不提供 source map**——桌面 renderer 只加载 bundle 字节；生产 source map 不通过桥接请求。
- **`rpc.handle` 仍依赖 web 服务器**——桌面形态只用 `rpc.intercept`（即 `dsh-api-remotes` 注册的那一个）；调用 `HostConnectionService.rpc.handle` 的插件仍期望 web 服务器路由，不属于本形态。
