// Scanning the filesystem for movies and their subtitles. Port of library.py.

import { readdirSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { SUBTITLE_EXTENSIONS, SUPPORTED_EXTENSIONS } from './config'
import * as parsing from './parsing'
import { normalizePath } from './paths'

export { normalizePath }

export interface FoundMovie {
  title: string
  path: string
}

function walk(dir: string, out: string[]): void {
  let entries: import('fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.isFile()) {
      if (SUPPORTED_EXTENSIONS.includes(extname(entry.name).toLowerCase())) out.push(full)
    }
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

export function findMovies(folder: string): FoundMovie[] {
  if (!isDir(folder)) return []
  const files: string[] = []
  walk(folder, files)
  const movies = files.map((full) => ({ title: parsing.displayTitle(full), path: full }))
  return movies.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
}

// Separators between a movie's base name and a subtitle suffix (language/flag tags).
const SUB_SEPARATORS = [' ', '.', '_', '-']

function subtitleMatches(subtitleBase: string, movieBase: string): boolean {
  if (subtitleBase === movieBase) return true
  for (const [base, other] of [
    [subtitleBase, movieBase],
    [movieBase, subtitleBase]
  ]) {
    if (base.startsWith(other) && base.length > other.length && SUB_SEPARATORS.includes(base[other.length])) {
      return true
    }
  }
  return false
}

/** Subtitles whose name matches the movie; [] when none (so 'Auto' lets the player auto-detect). */
export function findSubtitles(filePath: string): string[] {
  const folder = dirname(filePath)
  const movieBase = stemLower(basename(filePath))
  const candidates: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(folder)
  } catch {
    return []
  }
  for (const entry of entries) {
    if (!SUBTITLE_EXTENSIONS.has(extname(entry).toLowerCase())) continue
    const subtitleBase = stemLower(entry)
    if (subtitleMatches(subtitleBase, movieBase)) candidates.push(join(folder, entry))
  }
  return candidates.sort()
}

function stemLower(name: string): string {
  const ext = extname(name)
  return (ext ? name.slice(0, -ext.length) : name).toLowerCase()
}
