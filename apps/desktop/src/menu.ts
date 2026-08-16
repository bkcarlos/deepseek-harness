/** Application menu bar: the update check, new-session action, and standard edit/view/window roles.
 * @module @deepseek-ai/dsh-desktop/menu
 */

import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'

/** The project home, used by the Help menu's external links. */
const REPOSITORY_URL = 'https://github.com/deepseek-ai/deepseek-harness'

/** Actions the menu dispatches into the running app. */
export interface MenuActions {
  /** Trigger one auto-update check. */
  checkForUpdates: () => void
  /** Start a new session (dispatched to the renderer over IPC). */
  newSession: () => void
}

/**
 * Build the desktop application menu. Standard items use Electron roles (their
 * labels follow the operating system language); custom items dispatch the
 * passed actions or open external links.
 * @param actions - the app actions the menu items invoke.
 * @returns the assembled application menu.
 */
export function buildApplicationMenu(actions: MenuActions): Menu {
  const isMac = process.platform === 'darwin'
  const helpMenu: MenuItemConstructorOptions[] = [
    { label: '文档', click: () => { void shell.openExternal(REPOSITORY_URL) } },
    { label: '报告问题', click: () => { void shell.openExternal(`${REPOSITORY_URL}/issues`) } },
  ]
  if (!isMac) {
    helpMenu.push({ type: 'separator' })
    helpMenu.push({ label: '关于', click: () => { app.showAboutPanel() } })
  }
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS) or File menu (other platforms).
    isMac
      ? {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: '新建会话', accelerator: 'CmdOrCtrl+N', click: actions.newSession },
          { label: '检查更新…', click: actions.checkForUpdates },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }
      : {
        label: '文件',
        submenu: [
          { label: '新建会话', accelerator: 'CmdOrCtrl+N', click: actions.newSession },
          { label: '检查更新…', click: actions.checkForUpdates },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
    {
      label: '帮助',
      submenu: helpMenu,
    },
  ]
  return Menu.buildFromTemplate(template)
}
