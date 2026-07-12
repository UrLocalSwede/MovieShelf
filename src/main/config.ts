// Application constants + path helpers + API-key loading. Port of config.py.
// The user data root stays %APPDATA%\MovieShelf so existing installs' settings, keys,
// and cache carry over unchanged.

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export const APP_NAME = 'MovieShelf'

export const MOVIES_DIR = join(homedir(), 'Documents', 'Movies')
export const DEFAULT_FOLDERS = [MOVIES_DIR]

export const SUPPORTED_EXTENSIONS = ['.mkv', '.mp4']
export const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.mov', '.avi', '.m4v', '.wmv']
export const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt', '.ass', '.ssa', '.sub', '.idx'])

export const TMDB_API_BASE = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
export const TMDB_POSTER_SIZE = 'w500'
export const TMDB_COVER_SIZE = 'w342'
export const TMDB_BACKDROP_SIZE = 'w1280'
export const TMDB_COLLECTION_POSTER_SIZE = 'w185'

export const MAX_TRAILER_MINUTES = 10

/** %APPDATA%\MovieShelf — the data root shared with the legacy Python app. */
export function userConfigDir(): string {
  const base = process.env['APPDATA'] || join(homedir(), '.config')
  const dir = join(base, APP_NAME)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Isolated Electron/Chromium state dir, kept out of the data root. */
export function electronUserDataDir(): string {
  const dir = join(userConfigDir(), 'electron')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function logDir(): string {
  const dir = join(userConfigDir(), 'logs')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function cacheDir(): string {
  const dir = join(userConfigDir(), 'cache')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Directory holding bundled runtime resources (mpv, ffprobe, mpv_config, icons). */
export function resourcesRoot(): string {
  // Packaged: <install>/resources ; dev: <project>/resources
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
}

export function mpvExe(): string {
  return join(resourcesRoot(), 'mpv', 'mpv.exe')
}

export function ffprobeExe(): string {
  return join(resourcesRoot(), 'ffprobe', 'ffprobe.exe')
}

export function mpvConfigDir(): string {
  return join(resourcesRoot(), 'mpv_config')
}

export function iconPath(): string {
  return join(resourcesRoot(), 'icon.ico')
}

export interface ApiKeys {
  tmdb: string
  omdb: string
}

/**
 * API keys merged from environment variables (preferred) and config.json.
 * Read on demand so a key added later is picked up without restarting a build.
 */
export function loadKeys(): ApiKeys {
  const keys: ApiKeys = { tmdb: '', omdb: '' }
  const configFile = join(userConfigDir(), 'config.json')
  if (existsSync(configFile)) {
    try {
      let text = readFileSync(configFile, 'utf-8')
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // tolerate a BOM
      const data = JSON.parse(text)
      keys.tmdb = String(data.tmdb_api_key || '').trim()
      keys.omdb = String(data.omdb_api_key || '').trim()
    } catch {
      // ignore a malformed config.json; env vars may still supply keys
    }
  }
  keys.tmdb = (process.env['TMDB_API_KEY'] || keys.tmdb).trim()
  // OMDb falls back to a public sample key so ratings degrade gracefully without setup.
  keys.omdb = (process.env['OMDB_API_KEY'] || keys.omdb).trim() || 'trilogy'
  return keys
}

function configFilePath(): string {
  return join(userConfigDir(), 'config.json')
}

function readConfigJson(): Record<string, unknown> {
  const configFile = configFilePath()
  if (!existsSync(configFile)) return {}
  try {
    let text = readFileSync(configFile, 'utf-8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // tolerate a BOM
    const data = JSON.parse(text)
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  } catch {
    return {} // malformed config.json — treat as empty rather than crash
  }
}

/**
 * The API keys exactly as stored in config.json (no env-var override, no OMDb sample-key
 * fallback), so the settings UI shows what the user actually saved (empty when unset).
 */
export function readStoredKeys(): ApiKeys {
  const data = readConfigJson()
  return {
    tmdb: String(data.tmdb_api_key || '').trim(),
    omdb: String(data.omdb_api_key || '').trim()
  }
}

/** Persist API keys to config.json, preserving any other fields a future config may hold. */
export function saveKeys(keys: ApiKeys): void {
  const data = readConfigJson()
  data.tmdb_api_key = (keys.tmdb || '').trim()
  data.omdb_api_key = (keys.omdb || '').trim()
  writeFileSync(configFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}
