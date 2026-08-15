/** Copy dictionaries for the desktop update Settings section. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  nav: '更新',
  idle: '尚未检查更新。',
  checking: '正在检查更新…',
  available: '发现新版本 {version}。',
  notAvailable: '已是最新版本（{version}）。',
  downloading: '正在下载 {version}…',
  downloaded: '新版本 {version} 已就绪，重启后生效。',
  error: '检查更新失败：{message}',
  check: '检查更新',
  install: '重启并安装',
} satisfies Record<string, string>

/** Update locale key union. */
export type UpdateLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  nav: 'Updates',
  idle: 'Not checked yet.',
  checking: 'Checking for updates…',
  available: 'Version {version} is available.',
  notAvailable: 'You are up to date ({version}).',
  downloading: 'Downloading {version}…',
  downloaded: 'Version {version} is ready — restart to apply.',
  error: 'Update check failed: {message}',
  check: 'Check for updates',
  install: 'Restart and install',
} satisfies Record<UpdateLocaleKey, string>
