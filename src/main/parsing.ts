// Filename/folder parsing into a clean title + match hints. Port of parsing.py.
// Uses @ctrl/video-filename-parser in place of guessit, with the same parent-folder
// fallback and the verbatim regex cleaner as a backstop.

import { basename, dirname, extname } from 'path'
import { filenameParse, type ParsedMovie } from '@ctrl/video-filename-parser'
import * as cache from './cache'
import { canonicalTitle } from './matching'
import type { Parsed } from '../../shared/types'

// Generic container folders that carry no title information.
const GENERIC_FOLDERS = new Set(['film', 'films', 'movie', 'movies', 'video', 'videos', 'media'])

const NOISE_TOKENS = new Set([
  '1080p', '720p', '2160p', '4k', 'x264', 'x265', 'h264', 'h265', 'hevc', 'bluray',
  'brrip', 'webrip', 'web', 'web-dl', 'webdl', 'hdrip', 'hdtv', 'dvdrip', 'yify',
  'nordic', 'eng', 'aac', 'ac3', 'dts', 'remux', '2160', '1080', '720'
])

function stemOf(fileName: string): string {
  const ext = extname(fileName)
  return ext ? fileName.slice(0, -ext.length) : fileName
}

function capitalize(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word
}

/** Fallback title cleaner if the parser yields nothing. Ported from parsing._regex_clean. */
function regexClean(fileName: string): string {
  let title = stemOf(fileName)
  title = title.split(/[([]/)[0]
  title = title.replace(/[._-]+/g, ' ')
  const parts: string[] = []
  for (const part of title.split(/\s+/).filter(Boolean)) {
    if (NOISE_TOKENS.has(part.toLowerCase()) || /^(19|20)\d{2}$/.test(part)) {
      break // tokens after the year/quality are release cruft
    }
    parts.push(part)
  }
  const cleaned = parts.map(capitalize).join(' ')
  return cleaned || stemOf(fileName)
}

interface Guess {
  title: string
  year: number | null
  parsed: ParsedMovie | null
}

function guess(name: string): Guess {
  try {
    const g = filenameParse(name, false) as ParsedMovie
    const year = g.year && /^\d{4}$/.test(g.year) ? parseInt(g.year, 10) : null
    return { title: (g.title || '').trim(), year, parsed: g }
  } catch {
    return { title: '', year: null, parsed: null }
  }
}

export function parse(path: string): Parsed {
  const base = basename(path)
  const parent = basename(dirname(path))

  const g = guess(base)
  let title = g.title
  let year = g.year
  let detail = g.parsed

  if (parent && !GENERIC_FOLDERS.has(parent.toLowerCase()) && (!title || year === null)) {
    const folderG = guess(parent)
    if (!title) {
      title = folderG.title
      if (folderG.parsed) detail = folderG.parsed
    }
    if (year === null) year = folderG.year
  }

  if (!title) title = regexClean(base)

  const language = detail && detail.languages && detail.languages.length ? String(detail.languages[0]) : ''
  const source = detail && detail.sources && detail.sources.length ? String(detail.sources[0]) : ''
  const screenSize = detail && detail.resolution ? String(detail.resolution) : ''

  return {
    title: title.trim(),
    year,
    edition: '',
    source,
    screen_size: screenSize,
    country: '',
    language
  }
}

const READABLE_TRAILING_ARTICLE = /^(.*?),\s*(the|a|an)$/i
const READABLE_LEADING_ARTICLE = /^(the|a|an)\s+/i

/**
 * Alternate TMDb search strings for a parsed title, so a badly-named file still surfaces the
 * right hit. Includes the raw title, an article-normalized form ("Movie, The" → "The Movie"),
 * an article-stripped form, and the main title before a colon. Deduped by canonical form, and
 * the raw title always stays first (capped at 4 queries).
 */
export function titleVariants(title: string): string[] {
  const raw = (title || '').trim()
  if (!raw) return []

  const variants = [raw]
  const swap = raw.match(READABLE_TRAILING_ARTICLE)
  if (swap) variants.push(`${swap[2]} ${swap[1]}`.trim())
  if (READABLE_LEADING_ARTICLE.test(raw)) variants.push(raw.replace(READABLE_LEADING_ARTICLE, '').trim())
  const colon = raw.indexOf(':')
  if (colon > 0) variants.push(raw.slice(0, colon).trim())

  const seen = new Set<string>()
  const out: string[] = []
  for (const v of variants) {
    const key = canonicalTitle(v)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v)
    if (out.length >= 4) break
  }
  return out
}

/** Clean title for the library grid (cached by path+mtime). Includes the year when known. */
export function displayTitle(path: string): string {
  const cached = cache.getTitle(path)
  if (cached !== null) return cached
  const info = parse(path)
  let title = info.title
  if (info.year) title = `${title} (${info.year})`
  cache.setTitle(path, title)
  return title
}
