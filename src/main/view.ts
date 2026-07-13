// Which library the app is currently showing: a single saved folder (the default) or the combined
// "All libraries" view that merges every saved folder. The flag is runtime-only (resets to the
// single-folder view on restart, matching the "first saved folder is current" model in settings.ts).

import { basename, extname } from 'path'
import { ALL_LIBRARIES } from '../../shared/types'
import { findMovies, normalizePath, type FoundMovie } from './library'
import { loadFolder, loadSavedFolders } from './settings'
import { parse } from './parsing'
import { canonicalTitle } from './matching'

let viewAll = false

/** Numeric quality rank from a parsed resolution string ("2160p" → 2160, "" → 0). Higher is better. */
function resolutionRank(screenSize: string): number {
  const m = /(\d{3,4})/.exec(screenSize)
  return m ? parseInt(m[1], 10) : 0
}

/** A release "sample" clip (a few-MB teaser bundled with a rip), not the real movie. */
function isSample(path: string): boolean {
  const name = extname(path) ? basename(path).slice(0, -extname(path).length) : basename(path)
  return /(?:^|[\s._-])sample(?:[\s._-]|$)/i.test(name)
}

/**
 * Preference score for choosing which copy of a duplicate film to keep. Real files always beat
 * "sample" clips; within the same class the higher resolution wins.
 */
function keepScore(path: string, screenSize: string): number {
  return (isSample(path) ? 0 : 1_000_000) + resolutionRank(screenSize)
}

/**
 * Collapse duplicate movies — the same film appearing more than once (across folders in the combined
 * view, or as multiple editions/qualities in one folder). Movies are keyed by canonical title + year;
 * a missing year only matches other year-less copies, so remakes (different years) stay distinct.
 * The best copy of each film is kept (real over sample, then highest resolution; ties keep the first).
 */
export function dedupe(movies: FoundMovie[]): FoundMovie[] {
  const best = new Map<string, { path: string; score: number }>()
  const keyed = movies.map((m) => {
    const p = parse(m.path)
    return { movie: m, key: `${canonicalTitle(p.title)}|${p.year ?? ''}`, score: keepScore(m.path, p.screen_size) }
  })
  for (const it of keyed) {
    const cur = best.get(it.key)
    if (!cur || it.score > cur.score) best.set(it.key, { path: it.movie.path, score: it.score })
  }
  const keep = new Set([...best.values()].map((v) => v.path))
  return movies.filter((m) => keep.has(m.path))
}

export function isViewAll(): boolean {
  return viewAll
}

export function setViewAll(on: boolean): void {
  viewAll = on
}

/** The value reported to the renderer as the "current folder" (a real path, or the ALL sentinel). */
export function currentFolder(): string {
  return viewAll ? ALL_LIBRARIES : loadFolder()
}

/** Movies for the active view: one folder, or every saved folder merged. Duplicate films are hidden. */
export function currentMovies(): FoundMovie[] {
  if (!viewAll) return dedupe(findMovies(loadFolder()))
  const seen = new Set<string>()
  const merged: FoundMovie[] = []
  for (const folder of loadSavedFolders()) {
    for (const movie of findMovies(folder)) {
      const key = normalizePath(movie.path)
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(movie)
      }
    }
  }
  merged.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
  return dedupe(merged)
}
