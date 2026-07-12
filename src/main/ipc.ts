// ipcMain handler registration = the renderer-facing API contract (port of api.py).
// Every handler is wrapped so exceptions are logged and returned as { error }, never thrown
// across the boundary — matching api.py's _bridge decorator.

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, EVT } from '../../shared/types'
import type { ApiKeysPayload, AppSettings, MoviesPayload } from '../../shared/types'
import { log } from './logging'
import { findMovies, findSubtitles } from './library'
import { loadFolder, loadSavedFolders, saveFolders } from './settings'
import { readStoredKeys, saveKeys } from './config'
import { loadSettings, saveSettings } from './appSettings'
import { clearCache } from './cache'
import { getCover, getMetadata } from './metadata'
import * as player from './player'
import { checkForUpdates, quitAndInstall, setAutoDownload } from './updater'

function handle(channel: string, fn: (...args: any[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (exc) {
      log.error(`API call ${channel} failed`, exc)
      return { error: exc instanceof Error ? exc.message : String(exc) }
    }
  })
}

function moviesPayload(): MoviesPayload {
  const folder = loadFolder()
  const movies = findMovies(folder)
  if (movies.length) saveFolders(loadSavedFolders(), folder)
  log.info(`list_movies: folder=${folder} count=${movies.length}`)
  return {
    folder,
    count: movies.length,
    movies: movies.map((m) => ({ title: m.title, path: m.path })),
    folders: loadSavedFolders()
  }
}

export function registerIpc(): void {
  // -- library ---------------------------------------------------------------
  handle(IPC.listState, () => ({ folders: loadSavedFolders(), current: loadFolder() }))
  handle(IPC.listMovies, () => moviesPayload())

  handle(IPC.setFolder, (path: string) => {
    saveFolders([path, ...loadSavedFolders().filter((p) => p !== path)], path)
    return moviesPayload()
  })

  handle(IPC.removeFolder, (path: string) => {
    saveFolders(loadSavedFolders().filter((p) => p !== path))
    return moviesPayload()
  })

  handle(IPC.chooseFolder, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return { error: 'Window not ready.' }
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
    const folder = result.filePaths[0]
    saveFolders([folder, ...loadSavedFolders()], folder)
    return moviesPayload()
  })

  // -- details & playback ----------------------------------------------------
  handle(IPC.getCover, (path: string) => (path ? getCover(path) : {}))
  handle(IPC.getMetadata, (path: string) =>
    path ? getMetadata(path) : { error: 'No movie selected.' }
  )
  handle(IPC.refreshMetadata, (path: string) =>
    path ? getMetadata(path, true) : { error: 'No movie selected.' }
  )
  handle(IPC.getSubtitles, (path: string) => findSubtitles(path))

  // -- settings --------------------------------------------------------------
  handle(IPC.getApiKeys, () => readStoredKeys())
  handle(IPC.saveApiKeys, (keys: ApiKeysPayload) => {
    saveKeys({ tmdb: keys?.tmdb || '', omdb: keys?.omdb || '' })
    return { ok: true }
  })
  handle(IPC.getSettings, () => loadSettings())
  handle(IPC.saveSettings, (settings: AppSettings) => {
    const saved = saveSettings(settings || {})
    setAutoDownload(saved.autoDownloadUpdates) // apply the toggle live
    // Notify every window (e.g. the controls overlay re-reads skipSeconds for its label).
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(EVT.settingsChanged)
    }
    return saved
  })
  handle(IPC.clearCache, () => {
    clearCache()
    return { ok: true }
  })

  handle(IPC.play, async (path: string, subtitlePath = '') => {
    if (!path) return { error: 'No movie selected.' }
    const backend = await player.playMovie(path, subtitlePath || '')
    log.info(`Playing ${path} in ${backend}`)
    return { player: backend, embedded: player.isEmbedded() && backend === 'mpv' }
  })

  handle(IPC.playTrailer, async (trailerPath: string) => {
    if (!trailerPath) return { error: 'No trailer available.' }
    const backend = await player.playMovie(trailerPath)
    log.info(`Playing trailer ${trailerPath} in ${backend}`)
    return { player: backend, embedded: player.isEmbedded() && backend === 'mpv' }
  })

  handle(IPC.stopPlayback, () => {
    player.stop()
    return { stopped: true }
  })

  handle(IPC.playerKey, (name: string) => {
    player.sendKey(name || '')
    return { ok: true }
  })

  // mpv-level commands from the controls overlay — go straight to the player.
  handle(IPC.playerSeek, (seconds: number) => {
    player.seek(Number(seconds))
    return { ok: true }
  })
  // The overlay sends a direction (-1/+1); the jump amount comes from settings so it stays live.
  handle(IPC.playerSkip, (dir: number) => {
    const step = loadSettings().skipSeconds
    player.skip(Math.sign(Number(dir) || 0) * step)
    return { ok: true }
  })
  handle(IPC.playerSetPause, (paused: boolean) => {
    player.setPause(Boolean(paused))
    return { ok: true }
  })
  handle(IPC.playerSetVolume, (volume: number) => {
    player.setVolume(Number(volume))
    return { ok: true }
  })
  handle(IPC.playerSetMute, (muted: boolean) => {
    player.setMute(Boolean(muted))
    return { ok: true }
  })
  handle(IPC.playerToggleSub, (visible: boolean) => {
    player.toggleSub(Boolean(visible))
    return { ok: true }
  })

  // Fullscreen/exit change App-level layout + region sync, so route them back to the main
  // renderer to run through App's existing handlers rather than acting on the overlay directly.
  handle(IPC.controlsFullscreenToggle, () => {
    player.requestMainEvent(EVT.requestFullscreenToggle)
    return { ok: true }
  })
  handle(IPC.controlsExit, () => {
    player.requestMainEvent(EVT.requestExit)
    return { ok: true }
  })

  handle(IPC.showVideo, () => {
    player.show()
    return { ok: true }
  })

  handle(IPC.hideVideo, () => {
    player.hide()
    return { ok: true }
  })

  handle(IPC.setPlayerRegion, (x: number, y: number, w: number, h: number) => {
    player.setRegion(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    return { ok: true }
  })

  handle(IPC.setFullscreen, (on: boolean) => {
    player.setFullscreen(Boolean(on))
    return { fullscreen: Boolean(on) }
  })

  // -- updates ---------------------------------------------------------------
  handle(IPC.updateCheck, () => checkForUpdates())
  handle(IPC.updateInstall, () => quitAndInstall())

  log.info('IPC handlers registered')
}
