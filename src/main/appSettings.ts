// General app settings persisted to %APPDATA%\MovieShelf\settings.json. Read on demand so a
// saved change is picked up without a restart (mirrors config.ts's loadKeys() approach).
// Folder persistence is separate (settings.txt, see settings.ts).

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { userConfigDir } from './config'
import type { AppSettings } from '../../shared/types'

const DEFAULTS: AppSettings = {
  autoDownloadUpdates: true,
  defaultVolume: 100,
  skipSeconds: 10,
  prefetchRatings: true
}

function settingsFilePath(): string {
  return join(userConfigDir(), 'settings.json')
}

export function loadSettings(): AppSettings {
  const file = settingsFilePath()
  if (!existsSync(file)) return { ...DEFAULTS }
  try {
    let text = readFileSync(file, 'utf-8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // tolerate a BOM
    const data = JSON.parse(text)
    return {
      autoDownloadUpdates:
        typeof data.autoDownloadUpdates === 'boolean'
          ? data.autoDownloadUpdates
          : DEFAULTS.autoDownloadUpdates,
      defaultVolume: clampVolume(data.defaultVolume),
      skipSeconds: clampSkip(data.skipSeconds),
      prefetchRatings:
        typeof data.prefetchRatings === 'boolean' ? data.prefetchRatings : DEFAULTS.prefetchRatings
    }
  } catch {
    return { ...DEFAULTS } // malformed settings.json — fall back to defaults
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const merged: AppSettings = { ...loadSettings(), ...patch }
  merged.defaultVolume = clampVolume(merged.defaultVolume)
  merged.skipSeconds = clampSkip(merged.skipSeconds)
  writeFileSync(settingsFilePath(), JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

function clampVolume(v: unknown): number {
  const n = Number(v)
  if (!isFinite(n)) return DEFAULTS.defaultVolume
  return Math.min(Math.max(Math.round(n), 0), 100)
}

function clampSkip(v: unknown): number {
  const n = Number(v)
  if (!isFinite(n) || n <= 0) return DEFAULTS.skipSeconds
  return Math.min(Math.round(n), 600)
}
