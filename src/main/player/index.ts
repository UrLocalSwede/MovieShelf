// Playback subsystem: embedded mpv shown inside the app window, with a VLC / OS-default fallback.
// Replaces player.py + winembed.py. mpv renders into a borderless child window (see overlay.ts)
// kept glued to the HTML "video pane"; Electron owns the window so there is no ctypes, no manual
// DPI handling, and no message-pumping host thread.

import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { existsSync } from 'fs'
import { mpvExe } from '../config'
import { log } from '../logging'
import {
  createOverlay,
  createControlsOverlay,
  loadControls,
  nativeHwnd,
  CONTROLS_TRANSPARENT,
  CONTROLS_STRIP_H
} from './overlay'
import { Mpv } from './mpv'
import { playExternal } from './fallback'
import { normalizePath } from '../paths'
import { EVT, type PlayerBackend } from '../../../shared/types'

let ownerWindow: BrowserWindow | null = null
let overlay: BrowserWindow | null = null
let controls: BrowserWindow | null = null
let mpv: Mpv | null = null

let lastRect: { x: number; y: number; w: number; h: number } | null = null
let visible = false
let fullscreen = false

// Auto-hide state for the controls overlay (cursor polled from the main process so it works
// regardless of which native window is under the pointer, independent of HW acceleration).
let hideTimer: NodeJS.Timeout | null = null
let lastCursor: { x: number; y: number } | null = null
let idleMs = 0
let controlsActive = false
let paused = false
const POLL_MS = 150
const IDLE_HIDE_MS = 3000

function hasMpv(): boolean {
  return existsSync(mpvExe())
}

export function attach(win: BrowserWindow): void {
  ownerWindow = win
  // Re-glue the overlay whenever the owner window's geometry changes (replaces _follow_owner).
  const onGeom = (): void => reglue()
  win.on('move', onGeom)
  win.on('resize', onGeom)
  win.on('restore', onGeom)
  win.on('maximize', onGeom)
  win.on('unmaximize', onGeom)
  win.on('enter-full-screen', onGeom)
  win.on('leave-full-screen', onGeom)
}

async function ensureStarted(): Promise<boolean> {
  if (!ownerWindow || !hasMpv()) return false
  if (overlay && mpv && mpv.isRunning()) return true
  try {
    overlay = createOverlay(ownerWindow)
    overlay.hide()
    controls = createControlsOverlay(ownerWindow)
    controls.hide()
    // Once the controls renderer is ready, re-fire current mpv state so its UI isn't stuck on
    // defaults (mpv emits initial values before the window has finished loading).
    controls.webContents.on('did-finish-load', () => mpv?.refreshStatus())
    loadControls(controls)
    mpv = new Mpv()
    mpv.onEndFile = () => {} // keep-open=yes: mpv idles at EOF; UI drives exit
    mpv.onStatus = (patch) => {
      if (typeof patch.pause === 'boolean') paused = patch.pause
      if (controls && !controls.isDestroyed()) controls.webContents.send(EVT.playbackStatus, patch)
    }
    await mpv.start(nativeHwnd(overlay))
    log.info('Embedded mpv started')
    return true
  } catch (exc) {
    log.error('Failed to start embedded mpv', exc)
    teardown()
    return false
  }
}

function teardown(): void {
  stopHideTimer()
  try {
    mpv?.terminate()
  } catch {
    /* ignore */
  }
  try {
    if (overlay && !overlay.isDestroyed()) overlay.destroy()
  } catch {
    /* ignore */
  }
  try {
    if (controls && !controls.isDestroyed()) controls.destroy()
  } catch {
    /* ignore */
  }
  mpv = null
  overlay = null
  controls = null
}

function displayBounds(): Rectangle {
  const b = ownerWindow!.getBounds()
  return screen.getDisplayMatching(b).bounds
}

/** The video surface rect in screen coordinates, or null if geometry isn't known yet. */
function videoRect(): Rectangle | null {
  if (!ownerWindow) return null
  if (fullscreen) return displayBounds()
  if (!lastRect) return null
  const cb = ownerWindow.getContentBounds() // screen DIP of the web content origin
  return {
    x: cb.x + lastRect.x,
    y: cb.y + lastRect.y,
    width: Math.max(lastRect.w, 1),
    height: Math.max(lastRect.h, 1)
  }
}

function reglue(): void {
  if (!visible || !overlay || overlay.isDestroyed()) return
  const rect = videoRect()
  if (!rect) return
  overlay.setBounds(rect)
  if (controls && !controls.isDestroyed()) {
    // Design A covers the whole surface (transparent, video shows through); Design B is an opaque
    // strip glued to the bottom of the surface.
    const bounds = CONTROLS_TRANSPARENT
      ? rect
      : {
          x: rect.x,
          y: rect.y + Math.max(rect.height - CONTROLS_STRIP_H, 0),
          width: rect.width,
          height: Math.min(CONTROLS_STRIP_H, rect.height)
        }
    controls.setBounds(bounds)
    controls.setAlwaysOnTop(true)
    controls.moveTop()
  }
}

export function setRegion(x: number, y: number, w: number, h: number): void {
  lastRect = { x, y, w, h }
  reglue()
}

export function show(): void {
  if (!overlay || overlay.isDestroyed()) return
  visible = true
  overlay.showInactive() // never activates → keyboard focus stays with the web UI
  // For Design A the controls window stays shown and fades via CSS; for Design B it is shown only
  // while active. Either way reveal briefly on start (Netflix behaviour), then let the timer hide.
  if (CONTROLS_TRANSPARENT && controls && !controls.isDestroyed()) controls.showInactive()
  reglue()
  reveal()
  startHideTimer()
}

export function hide(): void {
  visible = false
  stopHideTimer()
  if (overlay && !overlay.isDestroyed()) overlay.hide()
  if (controls && !controls.isDestroyed()) controls.hide()
}

// -- controls auto-hide -----------------------------------------------------
function sendControlsActive(active: boolean): void {
  controlsActive = active
  if (!controls || controls.isDestroyed()) return
  controls.webContents.send(EVT.controlsActive, active)
  if (!CONTROLS_TRANSPARENT) {
    // Opaque strip: hiding the CSS isn't enough (the window paints black), so toggle the window.
    if (active) {
      controls.showInactive()
      controls.moveTop()
    } else {
      controls.hide()
    }
  }
}

function reveal(): void {
  idleMs = 0
  if (!controlsActive) sendControlsActive(true)
}

function startHideTimer(): void {
  stopHideTimer()
  lastCursor = null
  idleMs = 0
  hideTimer = setInterval(() => {
    if (!visible) return
    const rect = videoRect()
    if (!rect) return
    const p = screen.getCursorScreenPoint()
    const moved = !lastCursor || p.x !== lastCursor.x || p.y !== lastCursor.y
    lastCursor = p
    const inside =
      p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
    if (moved && inside) {
      reveal()
      return
    }
    // Keep controls up while paused; otherwise fade out after the idle window.
    if (paused) {
      idleMs = 0
      if (!controlsActive) sendControlsActive(true)
      return
    }
    idleMs += POLL_MS
    if (idleMs >= IDLE_HIDE_MS && controlsActive) sendControlsActive(false)
  }, POLL_MS)
}

function stopHideTimer(): void {
  if (hideTimer) clearInterval(hideTimer)
  hideTimer = null
  controlsActive = false
}

export function setFullscreen(on: boolean): void {
  fullscreen = on
  if (ownerWindow && ownerWindow.isFullScreen() !== on) ownerWindow.setFullScreen(on)
  reglue()
}

export async function playMovie(filePath: string, subtitlePath = ''): Promise<PlayerBackend> {
  const fixed = normalizePath(filePath)
  if (await ensureStarted()) {
    try {
      show()
      mpv!.load(fixed, subtitlePath ? normalizePath(subtitlePath) : '')
      return 'mpv'
    } catch (exc) {
      log.error('mpv playback failed, falling back', exc)
      hide()
    }
  }
  return playExternal(filePath, subtitlePath)
}

export function sendKey(name: string): void {
  mpv?.keypress(name)
}

export function seek(seconds: number): void {
  mpv?.seek(seconds, 'absolute')
}

export function skip(delta: number): void {
  mpv?.seek(delta, 'relative')
}

export function setPause(pause: boolean): void {
  mpv?.setPause(pause)
}

export function setVolume(volume: number): void {
  mpv?.setVolume(volume)
}

export function setMute(mute: boolean): void {
  mpv?.setMute(mute)
}

export function toggleSub(visible: boolean): void {
  mpv?.setSubVisibility(visible)
}

/** Forward a controls-overlay request (fullscreen/exit) to the main renderer to run in App. */
export function requestMainEvent(channel: string): void {
  if (ownerWindow && !ownerWindow.isDestroyed()) ownerWindow.webContents.send(channel)
}

export function stop(): void {
  hide()
  mpv?.stop()
}

export function isEmbedded(): boolean {
  return overlay !== null && !overlay.isDestroyed() && mpv !== null && mpv.isRunning()
}

export function shutdown(): void {
  teardown()
  ownerWindow = null
}
