/** Application menu bar: new session, open folder, settings, update check, and standard roles.
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
  /** Open a folder as a new workspace (dispatched to the renderer over IPC). */
  openFolder: () => void
  /** Open the Settings panel (dispatched to the renderer over IPC). */
  openSettings: () => void
  /** Open the dsh data directory in the operating system file manager. */
  openDataDirectory: () => void
  /** Relaunch the application. */
  relaunch: () => void
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

  const fileSubmenu: MenuItemConstructorOptions[] = [
    { label: '新建会话', accelerator: 'CmdOrCtrl+N', click: actions.newSession },
    { label: '打开文件夹…', accelerator: 'CmdOrCtrl+O', click: actions.openFolder },
    { type: 'separator' },
  ]
  if (!isMac) {
    // macOS has Settings in the application menu; other platforms put it in File.
    fileSubmenu.push({ label: '设置…', accelerator: 'CmdOrCtrl+,', click: actions.openSettings })
    fileSubmenu.push({ type: 'separator' })
  }
  fileSubmenu.push({ label: '检查更新…', click: actions.checkForUpdates })
  fileSubmenu.push({ type: 'separator' })
  fileSubmenu.push({ label: '打开数据目录', click: actions.openDataDirectory })
  fileSubmenu.push({ label: '重新启动', click: actions.relaunch })
  fileSubmenu.push({ type: 'separator' })
  if (isMac) {
    fileSubmenu.push({ role: 'close' })
  } else {
    fileSubmenu.push({ role: 'quit' })
  }

  const helpMenu: MenuItemConstructorOptions[] = [
    { label: '文档', click: () => { void shell.openExternal(REPOSITORY_URL) } },
    { label: '报告问题', click: () => { void shell.openExternal(`${REPOSITORY_URL}/issues`) } },
  ]
  if (!isMac) {
    helpMenu.push({ type: 'separator' })
    helpMenu.push({ label: '关于', click: () => { app.showAboutPanel() } })
  }

  const template: MenuItemConstructorOptions[] = []
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: '设置…', accelerator: 'CmdOrCtrl+,', click: actions.openSettings },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }
  template.push({ label: '文件', submenu: fileSubmenu })
  template.push({
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
  })
  template.push({
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
  })
  template.push({
    label: '窗口',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      { role: 'close' },
    ],
  })
  template.push({ label: '帮助', submenu: helpMenu })
  return Menu.buildFromTemplate(template)
}
