// Playback subsystem: embedded mpv shown inside the app window, with a VLC / OS-default fallback.
// Replaces player.py + winembed.py. mpv renders into a borderless child window (see overlay.ts)
// kept glued to the HTML "video pane"; Electron owns the window so there is no ctypes, no manual
// DPI handling, and no message-pumping host thread.

import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { existsSync } from 'fs'
import { mpvExe } from '../config'
import { log } from '../logging'
import { createOverlay, nativeHwnd } from './overlay'
import { Mpv } from './mpv'
import { playExternal } from './fallback'
import { normalizePath } from '../paths'
import type { PlayerBackend } from '../../../shared/types'

let ownerWindow: BrowserWindow | null = null
let overlay: BrowserWindow | null = null
let mpv: Mpv | null = null

let lastRect: { x: number; y: number; w: number; h: number } | null = null
let visible = false
let fullscreen = false

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
    mpv = new Mpv()
    mpv.onEndFile = () => {} // keep-open=yes: mpv idles at EOF; UI drives exit
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
  mpv = null
  overlay = null
}

function displayBounds(): Rectangle {
  const b = ownerWindow!.getBounds()
  return screen.getDisplayMatching(b).bounds
}

function reglue(): void {
  if (!visible || !overlay || overlay.isDestroyed() || !ownerWindow) return
  if (fullscreen) {
    overlay.setBounds(displayBounds())
    return
  }
  if (!lastRect) return
  const cb = ownerWindow.getContentBounds() // screen DIP of the web content origin
  overlay.setBounds({
    x: cb.x + lastRect.x,
    y: cb.y + lastRect.y,
    width: Math.max(lastRect.w, 1),
    height: Math.max(lastRect.h, 1)
  })
}

export function setRegion(x: number, y: number, w: number, h: number): void {
  lastRect = { x, y, w, h }
  reglue()
}

export function show(): void {
  if (!overlay || overlay.isDestroyed()) return
  visible = true
  overlay.showInactive() // never activates → keyboard focus stays with the web UI
  reglue()
}

export function hide(): void {
  visible = false
  if (overlay && !overlay.isDestroyed()) overlay.hide()
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
