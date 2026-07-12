import { contextBridge, ipcRenderer } from 'electron'
import { IPC, EVT } from '../../shared/types'
import type {
  MovieShelfApi,
  UpdateAvailablePayload,
  UpdateProgressPayload,
  UpdateDownloadedPayload,
  UpdateErrorPayload
} from '../../shared/types'

const api: MovieShelfApi = {
  listState: () => ipcRenderer.invoke(IPC.listState),
  listMovies: () => ipcRenderer.invoke(IPC.listMovies),
  setFolder: (path) => ipcRenderer.invoke(IPC.setFolder, path),
  removeFolder: (path) => ipcRenderer.invoke(IPC.removeFolder, path),
  chooseFolder: () => ipcRenderer.invoke(IPC.chooseFolder),
  getCover: (path) => ipcRenderer.invoke(IPC.getCover, path),
  getMetadata: (path) => ipcRenderer.invoke(IPC.getMetadata, path),
  refreshMetadata: (path) => ipcRenderer.invoke(IPC.refreshMetadata, path),
  getSubtitles: (path) => ipcRenderer.invoke(IPC.getSubtitles, path),
  play: (path, subtitlePath = '') => ipcRenderer.invoke(IPC.play, path, subtitlePath),
  playTrailer: (trailerPath) => ipcRenderer.invoke(IPC.playTrailer, trailerPath),
  stopPlayback: () => ipcRenderer.invoke(IPC.stopPlayback),
  playerKey: (name) => ipcRenderer.invoke(IPC.playerKey, name),
  showVideo: () => ipcRenderer.invoke(IPC.showVideo),
  hideVideo: () => ipcRenderer.invoke(IPC.hideVideo),
  setPlayerRegion: (x, y, w, h) => ipcRenderer.invoke(IPC.setPlayerRegion, x, y, w, h),
  setFullscreen: (on) => ipcRenderer.invoke(IPC.setFullscreen, on),
  checkForUpdates: () => ipcRenderer.invoke(IPC.updateCheck),
  quitAndInstall: () => ipcRenderer.invoke(IPC.updateInstall)
}

// Subscribe helpers for main→renderer events. Each returns an unsubscribe fn.
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const events = {
  onPlaybackEnded(cb: () => void): () => void {
    return on(EVT.playbackEnded, cb)
  },
  onUpdateAvailable(cb: (p: UpdateAvailablePayload) => void): () => void {
    return on(EVT.updateAvailable, cb)
  },
  onUpdateProgress(cb: (p: UpdateProgressPayload) => void): () => void {
    return on(EVT.updateProgress, cb)
  },
  onUpdateDownloaded(cb: (p: UpdateDownloadedPayload) => void): () => void {
    return on(EVT.updateDownloaded, cb)
  },
  onUpdateError(cb: (p: UpdateErrorPayload) => void): () => void {
    return on(EVT.updateError, cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('events', events)
