# @deepseek-ai/dsh-desktop-app

[English](README.md) | 中文

dsh 的 Electron 桌面形态组合包。[`cordis.patch.yml`](cordis.patch.yml) 叠加在 [`dsh-web-app`](../web-app/README.md)（后者又叠加在 [`dsh-base`](../base/README.md)）之上：它保留整个 GUI 阵容——宿主服务与每个 `dsh.client` 行——只替换传输层。HTTP 相关行（`webserver`、`web-runtime`、`web-startup`、`client-hmr`）被禁用，`connection` 行去掉仅 web 需要的 `webRuntime` 注入与 LAN 信任字面量，并新增一行挂载 [`dsh-host-desktop`](../../host/desktop/README.md) 桥接，后者在桌面 IPC 载体上提供 `ctx.desktop`（启动图、bundle 字节、fetch 形态网关）。

profile 依次叠加 `dsh-base`、`dsh-web-app`、本组合包；`apps/desktop` 壳层启动该组合，通过 `file://` 加载构建好的 `@deepseek-ai/dsh-web-frontend` 产物，并经 Electron IPC 桥接网关，而不是 HTTP 服务器。agent 平面各行与 web 形态完全一致（agent preset 拥有每个会话的工具集）；只有传输层不同。

## 模型体验

间接地，经由被插入行各自的包：本组合包是 patch 清单载体，它在共享 web 形态之上禁用 HTTP 行并挂载桌面桥接，persona、提示词与工具仍归那些被组合的行所有。

#### KV 缓存影响

无直接影响；本组合包既不组装也不发送任何 provider 请求。

## 已知限制与后续工作

- **尚无桌面形态提示 section** —— 壳层尚未注册引导模型面向原生窗口的 `app:desktop-surface` section；共享的 web persona 仍在不指明 GUI 指代对象的情况下称呼模型。
- **无客户端 bundle HMR** —— bundle 字节每次启动经 IPC 桥接加载一次；客户端插件热重载是仅 web 的链路，此处已禁用。
