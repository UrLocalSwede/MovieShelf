// The borderless, non-activating child window that hosts mpv's video surface. Replaces
// winembed.py's hand-rolled Win32 overlay — Electron's `parent` gives the owned-window
// semantics (floats above the app, hides on minimize) and `focusable:false` keeps it from
// ever stealing keyboard focus, so the renderer keeps focus and key-forwarding works.

import { BrowserWindow } from 'electron'

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
