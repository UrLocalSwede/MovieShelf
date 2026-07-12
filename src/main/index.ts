import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { setupLogging, log } from './logging'
import { electronUserDataDir, iconPath } from './config'
import { registerIpc } from './ipc'
import * as player from './player'
import { initUpdater, stopUpdater } from './updater'

// The embedded mpv video renders into a child window overlaid on the app. Chromium's GPU
// compositor (DirectComposition) otherwise paints over that native child window, occluding the
// video (audio plays, picture is black). Disabling HW-accelerated compositing lets the mpv child
// window show through. mpv keeps its own GPU decode/render (separate process), so video is
// unaffected; only the (lightweight) React UI loses GPU compositing.
app.disableHardwareAcceleration()

// One instance only — a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.setName('MovieShelf')
// Keep Chromium's own state (Cache/GPUCache/...) out of the MovieShelf data root
// (%APPDATA%\MovieShelf), which we own for settings/config/cache.
app.setPath('userData', electronUserDataDir())

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#100e11',
    autoHideMenuBar: true,
    show: false,
    ...(existsSync(iconPath()) ? { icon: iconPath() } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  player.attach(mainWindow)
  initUpdater(mainWindow) // no-op unless packaged
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  setupLogging()
  log.info(`MovieShelf ${app.getVersion()} starting`)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  stopUpdater()
  player.shutdown()
  app.quit()
})

app.on('before-quit', () => player.shutdown())
