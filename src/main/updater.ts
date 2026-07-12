// Auto-update via electron-updater against the public GitHub Releases feed. Only active in the
// packaged (installed) app; a no-op in dev / unpacked runs (no app-update.yml). Auto-downloads in
// the background and notifies the renderer, which shows a "Restart to update" banner.

import { app, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { log } from './logging'
import { EVT } from '../../shared/types'

// electron-updater is CommonJS; destructure to avoid ESM named-import interop issues.
const { autoUpdater } = electronUpdater

const SIX_HOURS = 6 * 60 * 60 * 1000
let win: BrowserWindow | null = null
let timer: ReturnType<typeof setInterval> | null = null

function send(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

export function initUpdater(mainWindow: BrowserWindow): void {
  if (!app.isPackaged) {
    log.info('updater: skipped (not packaged)')
    return
  }
  win = mainWindow
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = log as unknown as typeof autoUpdater.logger

  autoUpdater.on('checking-for-update', () => log.info('updater: checking for update'))
  autoUpdater.on('update-available', (info) => {
    log.info(`updater: update available ${info.version}`)
    send(EVT.updateAvailable, { version: info.version })
  })
  autoUpdater.on('update-not-available', () => log.info('updater: no update available'))
  autoUpdater.on('download-progress', (p) => send(EVT.updateProgress, { percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => {
    log.info(`updater: update downloaded ${info.version}`)
    send(EVT.updateDownloaded, { version: info.version })
  })
  autoUpdater.on('error', (err) => {
    log.error('updater: error', err)
    send(EVT.updateError, { message: err instanceof Error ? err.message : String(err) })
  })

  void autoUpdater.checkForUpdates().catch((e) => log.debug('updater: initial check failed', String(e)))
  timer = setInterval(
    () => void autoUpdater.checkForUpdates().catch((e) => log.debug('updater: periodic check failed', String(e))),
    SIX_HOURS
  )
}

export function stopUpdater(): void {
  if (timer) clearInterval(timer)
  timer = null
}

export function checkForUpdates(): { checking: boolean } | { error: string } {
  if (!app.isPackaged) return { error: 'Updates are only available in the installed app.' }
  void autoUpdater.checkForUpdates().catch((e) => log.debug('updater: manual check failed', String(e)))
  return { checking: true }
}

export function quitAndInstall(): { ok: true } | { error: string } {
  if (!app.isPackaged) return { error: 'Updates are only available in the installed app.' }
  // Defer so the IPC reply is delivered before the app tears down.
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { ok: true }
}
