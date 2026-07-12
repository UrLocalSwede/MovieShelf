// Find a local trailer near a movie file. Port of trailers.py.
//
// A trailer is a short video (<= MAX_TRAILER_MINUTES) located either in the movie's folder,
// named like a trailer AND related to the movie, or inside a dedicated Trailers/Extras subfolder.

import { readdirSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { MAX_TRAILER_MINUTES, VIDEO_EXTENSIONS } from './config'
import { probe } from './fingerprint'
import { similarity } from './matching'
import { normcaseNormpath } from './paths'
import type { Trailer } from '../../shared/types'

const TRAILER_WORDS = ['trailer', 'teaser', 'preview']
const EXTRA_DIRS = new Set(['trailer', 'trailers', 'extras', 'featurettes', 'extra'])

function isVideo(name: string): boolean {
  return VIDEO_EXTENSIONS.includes(extname(name).toLowerCase())
}

function namedTrailer(name: string): boolean {
  const low = name.toLowerCase()
  return TRAILER_WORDS.some((w) => low.includes(w))
}

function stripTrailerWords(stem: string): string {
  let low = stem.toLowerCase()
  for (const w of TRAILER_WORDS) low = low.split(w).join(' ')
  return low.replace(/[._-]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
}

function relates(movieBase: string, entryStem: string): boolean {
  const cleaned = stripTrailerWords(entryStem)
  if (!cleaned) return true // e.g. just "trailer.mkv" beside the movie
  if (movieBase.includes(cleaned) || cleaned.includes(movieBase)) return true
  return similarity(movieBase, cleaned) >= 0.6
}

function durationOk(path: string, named: boolean): boolean {
  const duration = probe(path).duration_min
  if (duration === null || duration === undefined) return named // unknown length: trust a named file
  return duration <= MAX_TRAILER_MINUTES
}

function stem(name: string): string {
  const ext = extname(name)
  return ext ? name.slice(0, -ext.length) : name
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}
function isFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

export function findTrailer(path: string): Trailer | null {
  const folder = dirname(path)
  const movieNorm = normcaseNormpath(path)
  const movieBase = stem(basename(path)).toLowerCase()
  const candidates: [number, string, boolean][] = [] // [priority, fullPath, named]

  let entries: string[]
  try {
    entries = readdirSync(folder)
  } catch {
    return null
  }

  for (const entry of entries) {
    const full = join(folder, entry)
    if (isDir(full) && EXTRA_DIRS.has(entry.toLowerCase())) {
      try {
        for (const sub of readdirSync(full).sort()) {
          const subFull = join(full, sub)
          if (isFile(subFull) && isVideo(sub)) candidates.push([0, subFull, namedTrailer(sub)])
        }
      } catch {
        continue
      }
    } else if (isFile(full) && isVideo(entry)) {
      if (normcaseNormpath(full) === movieNorm) continue
      if (namedTrailer(entry) && relates(movieBase, stem(entry))) candidates.push([1, full, true])
    }
  }

  // Prefer dedicated-folder trailers, then trailer-named, then verify duration.
  candidates.sort((a, b) => a[0] - b[0] || Number(!a[2]) - Number(!b[2]))
  for (const [, full, named] of candidates) {
    if (durationOk(full, named)) return { path: full, name: basename(full) }
  }
  return null
}
