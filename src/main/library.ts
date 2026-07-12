// Scanning the filesystem for movies and their subtitles. Port of library.py.

import { readdirSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { SUBTITLE_EXTENSIONS, SUPPORTED_EXTENSIONS } from './config'
import * as parsing from './parsing'
import { normalizePath } from './paths'
import { similarity } from './matching'
import { detectSubtitle, languageFromFolder, withFolderLanguage } from './subtitles'
import type { SubtitleEntry } from '../../shared/types'

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
// Sibling folders that conventionally hold subtitle files for the movies beside them.
const SUBTITLE_FOLDER_NAMES = new Set(['subs', 'subtitles', 'sub', 'subtitle'])
// Minimum fuzzy similarity for a differently-named subtitle to be accepted for a movie.
const MATCH_THRESHOLD = 0.6

/** Legacy strict rule: exact stem, or one stem is a prefix of the other + a separator. */
function strictMatch(subtitleBase: string, movieBase: string): boolean {
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

interface SubCandidate {
  path: string
  fileName: string
  depth: number // 0 = movie's own folder, 1+ = nested subtitle folder
  folderHint: string // immediate parent folder name (may name a language, e.g. "English")
}

function listNames(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function isSubtitleFile(name: string): boolean {
  return SUBTITLE_EXTENSIONS.has(extname(name).toLowerCase())
}

/** Collect subtitle files from the movie folder and any nested Subs/ folders (max depth 2). */
function collectSubtitleCandidates(folder: string): SubCandidate[] {
  const out: SubCandidate[] = []
  const folderName = basename(folder)

  for (const name of listNames(folder)) {
    const full = join(folder, name)
    if (isSubtitleFile(name)) {
      out.push({ path: full, fileName: name, depth: 0, folderHint: folderName })
      continue
    }
    // Descend only into conventionally-named subtitle folders.
    if (!isDir(full) || !SUBTITLE_FOLDER_NAMES.has(name.toLowerCase())) continue
    for (const subName of listNames(full)) {
      const subFull = join(full, subName)
      if (isSubtitleFile(subName)) {
        out.push({ path: subFull, fileName: subName, depth: 1, folderHint: name })
      } else if (isDir(subFull)) {
        // One level deeper, e.g. Subs/English/2_en.srt — folder often names the language.
        for (const leaf of listNames(subFull)) {
          if (isSubtitleFile(leaf)) {
            out.push({ path: join(subFull, leaf), fileName: leaf, depth: 2, folderHint: subName })
          }
        }
      }
    }
  }
  return out
}

interface ScoredSub {
  entry: SubtitleEntry
  score: number
  hasLanguage: boolean
  dir: string
  stem: string
  ext: string
}

/**
 * Subtitles for a movie, ranked best-first, each labeled with detected language + flags.
 * Returns [] when none (so the 'Auto' picker lets the player auto-detect). Because the UI
 * defaults 'Auto' to the first entry, the top-ranked (most likely) subtitle becomes the default.
 */
export function findSubtitles(filePath: string): SubtitleEntry[] {
  const folder = dirname(filePath)
  const movieBase = stemLower(basename(filePath))

  const videoCount = listNames(folder).filter((n) =>
    SUPPORTED_EXTENSIONS.includes(extname(n).toLowerCase())
  ).length
  const singleVideo = videoCount <= 1

  const scored: ScoredSub[] = []
  for (const cand of collectSubtitleCandidates(folder)) {
    let info = detectSubtitle(cand.fileName)
    const folderLang = languageFromFolder(cand.folderHint)
    if (folderLang) info = withFolderLanguage(info, folderLang)

    const subBase = stemLower(cand.fileName)
    const cleanBase = (info.cleanStem || subBase).toLowerCase()
    const strict = strictMatch(subBase, movieBase)
    const sim = Math.max(similarity(cleanBase, movieBase), similarity(subBase, movieBase))

    // Accept a strict name match, a strong fuzzy match, or — when the folder holds a single
    // movie — any subtitle sitting beside/under it (the common "Subs/English.srt" case).
    if (!strict && sim < MATCH_THRESHOLD && !singleVideo) continue

    const score = (strict ? 1 : sim) - cand.depth * 0.02
    scored.push({
      entry: {
        name: cand.fileName,
        path: cand.path,
        language: info.language,
        label: info.label,
        forced: info.forced
      },
      score,
      hasLanguage: Boolean(info.code),
      dir: dirname(cand.path),
      stem: stemLower(cand.fileName),
      ext: extname(cand.fileName).toLowerCase()
    })
  }

  const deduped = dropVobsubIndexed(scored)
  deduped.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.hasLanguage) - Number(a.hasLanguage) ||
      a.entry.name.toLowerCase().localeCompare(b.entry.name.toLowerCase())
  )
  return deduped.map((s) => s.entry)
}

/** Drop a VobSub `.sub` when its `.idx` sits next to it (mpv loads the pair via the `.idx`). */
function dropVobsubIndexed(items: ScoredSub[]): ScoredSub[] {
  const idxKeys = new Set(items.filter((i) => i.ext === '.idx').map((i) => `${i.dir}|${i.stem}`))
  return items.filter((i) => !(i.ext === '.sub' && idxKeys.has(`${i.dir}|${i.stem}`)))
}

function stemLower(name: string): string {
  const ext = extname(name)
  return (ext ? name.slice(0, -ext.length) : name).toLowerCase()
}
