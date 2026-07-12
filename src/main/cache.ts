// Local cache for matched metadata, artwork, and cleaned grid titles. Port of cache.py.
//
//   cache/movies/<sha1>/meta.json      matched metadata
//   cache/movies/<sha1>/poster.jpg     downloaded poster
//   cache/movies/<sha1>/backdrop.jpg   downloaded backdrop
//   cache/titles.json                  path -> cleaned grid title (with mtime)
//
// The sha1 key and titles-key normalization intentionally match the Python app byte-for-byte
// so an existing %APPDATA%\MovieShelf\cache carries over.

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'fs'
import { join } from 'path'
import { cacheDir } from './config'
import { normcase, normcaseNormpath } from './paths'
import { log } from './logging'
import type { Metadata } from '../../shared/types'

function key(path: string): string {
  return createHash('sha1').update(normcaseNormpath(path), 'utf-8').digest('hex')
}

export function movieDir(path: string): string {
  const d = join(cacheDir(), 'movies', key(path))
  mkdirSync(d, { recursive: true })
  return d
}

// -- matched metadata ---------------------------------------------------------
export function load(path: string): Metadata | null {
  const metaFile = join(cacheDir(), 'movies', key(path), 'meta.json')
  if (!existsSync(metaFile)) return null
  try {
    return JSON.parse(readFileSync(metaFile, 'utf-8')) as Metadata
  } catch (exc) {
    log.warn('Bad cache meta for', path, String(exc))
    return null
  }
}

export function save(path: string, meta: Metadata): void {
  writeFileSync(join(movieDir(path), 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')
}

export function saveImage(path: string, name: string, data: Buffer): string {
  writeFileSync(join(movieDir(path), name), data)
  return name
}

/** Base64 data URI for a cached image, or '' if missing (dodges file:// restrictions). */
export function imageDataUri(path: string, name: string): string {
  if (!name) return ''
  const f = join(cacheDir(), 'movies', key(path), name)
  if (!existsSync(f)) return ''
  try {
    const mime = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,` + readFileSync(f).toString('base64')
  } catch {
    return ''
  }
}

// -- grid titles --------------------------------------------------------------
interface TitleEntry {
  title: string
  mtime: number
}
let titles: Record<string, TitleEntry> | null = null

function titlesFile(): string {
  return join(cacheDir(), 'titles.json')
}

function loadTitles(): Record<string, TitleEntry> {
  if (titles === null) {
    const f = titlesFile()
    let loaded: Record<string, TitleEntry> = {}
    if (existsSync(f)) {
      try {
        loaded = JSON.parse(readFileSync(f, 'utf-8'))
      } catch {
        loaded = {}
      }
    }
    titles = loaded
  }
  return titles
}

function mtime(path: string): number {
  try {
    return statSync(path).mtimeMs / 1000 // seconds, matching Python os.path.getmtime
  } catch {
    return 0
  }
}

export function getTitle(path: string): string | null {
  const entry = loadTitles()[normcase(path)]
  if (entry && entry.mtime === mtime(path)) return entry.title
  return null
}

export function setTitle(path: string, title: string): void {
  const t = loadTitles()
  t[normcase(path)] = { title, mtime: mtime(path) }
  try {
    writeFileSync(titlesFile(), JSON.stringify(t), 'utf-8')
  } catch (exc) {
    log.debug('Could not write titles cache:', String(exc))
  }
}

// -- clear --------------------------------------------------------------------
/** Wipe all cached metadata, artwork, and grid titles; the next lookups re-fetch. */
export function clearCache(): void {
  const dir = cacheDir()
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  titles = null // drop the in-memory titles cache so it reloads empty
  log.info('Cache cleared')
}
