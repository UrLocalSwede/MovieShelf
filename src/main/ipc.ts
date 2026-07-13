// ipcMain handler registration = the renderer-facing API contract (port of api.py).
// Every handler is wrapped so exceptions are logged and returned as { error }, never thrown
// across the boundary — matching api.py's _bridge decorator.

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, EVT, ALL_LIBRARIES } from '../../shared/types'
import type { ApiKeysPayload, AppSettings, MoviesPayload } from '../../shared/types'
import { log } from './logging'
import { findSubtitles } from './library'
import { listCollections } from './collections'
import { currentFolder, currentMovies, isViewAll, setViewAll } from './view'
import { loadSavedFolders, saveFolders } from './settings'
import { readStoredKeys, saveKeys } from './config'
import { loadSettings, saveSettings } from './appSettings'
import { clearCache } from './cache'
import { getCover, getMetadata } from './metadata'
import * as ratings from './ratings'
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

/** Send an event to every live window (renderer + controls overlay). */
function broadcast(channel: string, payload?: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload)
  }
}

function moviesPayload(): MoviesPayload {
  const folder = currentFolder()
  const movies = currentMovies()
  // Keep the single active folder recorded as "current" (first); never persist the ALL sentinel.
  if (!isViewAll() && movies.length) saveFolders(loadSavedFolders(), folder)
  log.info(`list_movies: folder=${isViewAll() ? 'ALL' : folder} count=${movies.length}`)
  const mapped = movies.map((m) => ({ title: m.title, path: m.path }))
  // Warm every movie's rating in the background (cancels a prior sweep when the library changes).
  ratings.startPrefetch(mapped.map((m) => m.path), broadcast)
  return {
    folder,
    count: movies.length,
    movies: mapped,
    folders: loadSavedFolders()
  }
}

export function registerIpc(): void {
  // -- library ---------------------------------------------------------------
  handle(IPC.listState, () => ({ folders: loadSavedFolders(), current: currentFolder() }))
  handle(IPC.listMovies, () => moviesPayload())
  handle(IPC.listCollections, () => listCollections())

  handle(IPC.setFolder, (path: string) => {
    if (path === ALL_LIBRARIES) {
      setViewAll(true) // combined view of every saved folder
      return moviesPayload()
    }
    setViewAll(false)
    saveFolders([path, ...loadSavedFolders().filter((p) => p !== path)], path)
    return moviesPayload()
  })

  handle(IPC.removeFolder, (path: string) => {
    // Stay in whatever view is active; the combined list just recomputes without this folder.
    saveFolders(loadSavedFolders().filter((p) => p !== path))
    return moviesPayload()
  })

  handle(IPC.chooseFolder, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return { error: 'Window not ready.' }
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
    const folder = result.filePaths[0]
    setViewAll(false) // adding a folder switches to it
    saveFolders([folder, ...loadSavedFolders()], folder)
    return moviesPayload()
  })

  // -- details & playback ----------------------------------------------------
  handle(IPC.getCover, (path: string) => (path ? getCover(path) : {}))
  handle(IPC.getRatings, (paths: string[]) => ratings.currentRatings(Array.isArray(paths) ? paths : []))
  // Opening a movie is foreground work: pause the rating sweep around it so it loads at full speed.
  handle(IPC.getMetadata, async (path: string) => {
    if (!path) return { error: 'No movie selected.' }
    ratings.beginForeground()
    try {
      return await getMetadata(path)
    } finally {
      ratings.endForeground()
    }
  })
  handle(IPC.refreshMetadata, async (path: string) => {
    if (!path) return { error: 'No movie selected.' }
    ratings.beginForeground()
    try {
      return await getMetadata(path, true)
    } finally {
      ratings.endForeground()
    }
  })
  handle(IPC.getSubtitles, (path: string) => findSubtitles(path))

  // -- settings --------------------------------------------------------------
  handle(IPC.getApiKeys, () => readStoredKeys())
  handle(IPC.saveApiKeys, (keys: ApiKeysPayload) => {
    saveKeys({ tmdb: keys?.tmdb || '', omdb: keys?.omdb || '' })
    return { ok: true }
  })
  handle(IPC.getSettings, () => loadSettings())
  handle(IPC.saveSettings, (settings: AppSettings) => {
    const wasPrefetching = loadSettings().prefetchRatings
    const saved = saveSettings(settings || {})
    setAutoDownload(saved.autoDownloadUpdates) // apply the toggle live
    // Apply the background-caching toggle live: stop a running sweep, or start one now.
    if (wasPrefetching && !saved.prefetchRatings) {
      ratings.cancelPrefetch()
      broadcast(EVT.ratingsProgress, { done: 0, total: 0, running: false }) // clear the sidebar bar
    } else if (!wasPrefetching && saved.prefetchRatings) {
      ratings.startPrefetch(currentMovies().map((m) => m.path), broadcast)
    }
    // Notify every window (e.g. the controls overlay re-reads skipSeconds for its label).
    broadcast(EVT.settingsChanged)
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
