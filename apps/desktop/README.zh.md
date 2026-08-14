# @deepseek-ai/dsh-desktop

[English](README.md) | 中文

DeepSeek Harness 的 Electron 桌面壳层。它在进程内启动 `desktop` profile（dsh-base + dsh-web-app + dsh-desktop-app），通过 Electron IPC 而不是 HTTP 服务器桥接 GUI，并打包出原生安装程序。

- `src/main.ts` —— 主进程：启动配置树，经 `ipcMain` 接线 `ctx.desktop`（启动 manifest、bundle 字节、把 `Response` 正文块流回的流式 fetch），并打开一个经 `file://` 加载的 `BrowserWindow`。
- `src/preload.ts` —— 暴露 `window.dshDesktop`（客户端 `connection` 插件读取的 `DesktopFetchBridge`，加上启动 manifest 与 bundle 加载器）。
- `src/renderer.ts` —— 薄 renderer 入口：从桥接组装 `__DSH_BOOT__`，并交给壳层一个在页内执行 bundle 字节的 `loadBundle` 缝。
- `src/boot.ts` —— 组合并启动 `desktop` profile，与 CLI 的 profile 启动相呼应。

## 构建与打包

```sh
pnpm install
pnpm run build:lib                          # client bundles + vendored runtime + Typert contracts
pnpm --filter @deepseek-ai/dsh-desktop run dist   # vite + tsdown + electron-builder
```

安装程序落在 `release/`（macOS 为 `dmg`/`zip`，Windows 为 `exe`，Linux 为 `AppImage`/`deb`）。签名默认关闭（CI 中 `CSC_IDENTITY_AUTO_DISCOVERY=false`）；release 构建会按平台加上签名与公证。

## 打包不变量

两条 electron-builder 事实是承重的，不能被「简化」掉：

- **`asar: false`** —— 启动复用 CLI 的 profile 机制，其 `healProfilesModuleFallback` 把 `$DSH_HOME/profiles/node_modules` 软链到应用的依赖树，Loader 再经这些真实路径解析裸插件名。指向 asar 路径的软链无法被导入。
- **依赖清单即工作区 peer 闭包** —— electron-builder 沿 `dependencies` 图走，却不复刻 pnpm 每包的 `peerDependencies` 软链，因此每个只经 peer 可达的 `dsh-*` 包（如 `dsh-timeout`、`dsh-scope`）都直接声明在这里。配置树变化时重新生成闭包（见 `.agents/notes/implemented/architecture/2026-08-14-electron-desktop-ipc-surface.md` 中的 Agent Note）。

## 已知限制

- **未签名的开发构建** —— 安装程序未签名；Gatekeeper/SmartScreen 要求签名 + 公证才能分发。
- **仅 arm64 的 macOS 输出** —— 默认矩阵构建宿主架构；x64 需要显式指定 `arch` 目标。
