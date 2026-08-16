# @deepseek-ai/dsh-client-desktop-menu

[English](README.md) | 中文

仅用于桌面的无渲染客户端插件，将 Electron 原生菜单栏命令分派到客户端服务。菜单由桌面壳层的主进程构建，并通过 `window.dshDesktop.menu.onAction` 发送操作字符串；此插件订阅这些字符串，将 `new-session` 路由到 `ctx.workspaces.startSession()`，将 `open-folder` 路由到原生目录选择与工作区创建流程，并通过 `desktop/menu` 事件转发其余操作。

## 模型体验

无，因为此插件只分派 UI 操作，不提供模型可见输入，也不写入会话日志。

#### KV 缓存影响

无；此包既不组装也不发送提供方请求。

## 已知限制与延期工作

- **由渲染器功能拥有的命令依赖对应插件。** 如果拥有某项 `desktop/menu` 操作的客户端插件未加载，该操作不会产生效果。
