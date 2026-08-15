/** Application menu bar: the update check plus standard edit/view/window roles. @module @deepseek-ai/dsh-desktop/menu */

import { app, Menu, type MenuItemConstructorOptions } from 'electron'

/**
 * Build the desktop application menu. Standard items use Electron roles (their
 * labels follow the operating system language); the only custom action is the
 * update check, shared with the Settings section through the same callback.
 * @param checkForUpdates - triggers one auto-update check.
 * @returns the assembled application menu.
 */
export function buildApplicationMenu(checkForUpdates: () => void): Menu {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS) or File menu (other platforms).
    isMac
      ? {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: '检查更新…', click: checkForUpdates },
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
          { label: '检查更新…', click: checkForUpdates },
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
  ]
  return Menu.buildFromTemplate(template)
}
