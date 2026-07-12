// The borderless, non-activating child window that hosts mpv's video surface. Replaces
// winembed.py's hand-rolled Win32 overlay — Electron's `parent` gives the owned-window
// semantics (floats above the app, hides on minimize) and `focusable:false` keeps it from
// ever stealing keyboard focus, so the renderer keeps focus and key-forwarding works.

import { BrowserWindow } from 'electron'
import { join } from 'path'

// Design A (transparent, full video rect) vs Design B (opaque bottom strip). Because the app runs
// with HW acceleration disabled (mpv-visibility requirement), transparent windows may render black
// on some machines; if that happens, flip this to false to ship the always-reliable opaque strip.
export const CONTROLS_TRANSPARENT = true

/** Height of the interactive control strip at the bottom of the video (Design B window height). */
export const CONTROLS_STRIP_H = 150

export function createOverlay(parent: BrowserWindow): BrowserWindow {
  return new BrowserWindow({
    parent,
    frame: false,
    show: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#000000',
    // No web content is loaded; mpv paints into this window's native surface via --wid.
    webPreferences: { offscreen: false }
  })
}

/** The overlay's native window handle as a decimal string for mpv's --wid. */
export function nativeHwnd(win: BrowserWindow): string {
  const buf = win.getNativeWindowHandle()
  // Win64: HWND is a 64-bit pointer stored little-endian (real handles fit in the low bits).
  if (buf.length >= 8) return buf.readBigUInt64LE(0).toString()
  return String(buf.readUInt32LE(0))
}

// A second borderless, non-activating child window stacked above the mpv surface. It hosts the
// React playback controls (its own renderer entry). focusable:false keeps keyboard focus on the
// main window so the existing key-forwarding keeps working, while mouse clicks still reach it
// (mpv consumes no mouse input, so there is nothing to click through to).
export function createControlsOverlay(parent: BrowserWindow): BrowserWindow {
  return new BrowserWindow({
    parent,
    frame: false,
    show: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    transparent: CONTROLS_TRANSPARENT,
    backgroundColor: CONTROLS_TRANSPARENT ? '#00000000' : '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
}

/** Load the controls renderer entry, mirroring the main window's dev/prod branch. */
export function loadControls(win: BrowserWindow): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/controls.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/controls.html'))
  }
}
