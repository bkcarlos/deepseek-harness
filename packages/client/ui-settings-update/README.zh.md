# @deepseek-ai/dsh-client-ui-settings-update

[English](README.md) | 中文

仅用于桌面的设置区块，展示 Electron 自动更新生命周期：当前状态（空闲、检查中、有更新、无更新、下载中、已下载或错误）、下载进度、手动**检查更新**操作，以及构建下载完成后的**重启并安装**操作。

此区块读取 preload 暴露的 `window.dshDesktop.updates` 桥接，并贡献一个 `settings.section` 条目（`id: update`），因此只有在桌面 bundle 中才有实际作用；普通 `dsh web` 界面会显示空闲状态，相关操作不会执行任何动作。

## 模型体验

无，因为此插件只渲染更新状态和控件，不提供模型可见输入，也不写入会话日志。

#### KV 缓存影响

无；此包既不组装也不发送提供方请求。

## 已知限制与延期工作

- **更新状态仅存在于主进程。** 渲染器镜像 Electron 主进程推送的内容；在 macOS 上，未签名构建的签名验证会在 updater 中失败，此区块会将其报告为 `error` 状态，而不是下载更新。
- **进度只有一个百分比。** electron-updater 每个 `download-progress` 事件报告一个百分比；事件也提供字节数和传输速度，但此界面不显示这些信息。
