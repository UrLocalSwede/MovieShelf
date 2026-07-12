// Average-rating computation + a background prefetch sweep that resolves every movie's rating on
// startup (and whenever the library reloads). Ratings live only inside cached Metadata, so the sweep
// reuses getMetadata's fetch+cache path and reports progress to the renderer for the sidebar bar.

import { EVT } from '../../shared/types'
import type { Metadata, RatingInfo, Ratings } from '../../shared/types'
import { loadKeys } from './config'
import { loadSettings } from './appSettings'
import * as cache from './cache'
import { getMetadata } from './metadata'
import { log } from './logging'

const PREFETCH_WORKERS = 2
const START_DELAY_MS = 3500 // let the visible covers + first interactions grab the network first
const STEP_DELAY_MS = 80 // gentle pacing between titles so the sweep never saturates
const FG_WAIT_MS = 150 // re-check interval while paused for a foreground fetch

/** Parse the leading number out of a rating string like "7.8/10", "91%", or "68". NaN → null. */
function leadingNumber(value: string | undefined): number | null {
  if (!value) return null
  const m = /-?\d+(?:\.\d+)?/.exec(value)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/**
 * Average of every available rating, normalized to a 0–10 scale, rounded to one decimal.
 * TMDb & IMDb are already /10; Rotten Tomatoes is a percentage (→ /10); Metacritic is /100 (→ /10).
 * Returns null when no source is present/parseable.
 */
export function averageRating(r?: Ratings): number | null {
  if (!r) return null
  const parts: number[] = []
  const push = (n: number | null): void => {
    if (n !== null) parts.push(Math.max(0, Math.min(10, n)))
  }
  push(leadingNumber(r.imdb))
  push(leadingNumber(r.tmdb))
  const rt = leadingNumber(r.rotten_tomatoes)
  push(rt === null ? null : rt / 10)
  const mc = leadingNumber(r.metacritic)
  push(mc === null ? null : mc / 10)
  if (!parts.length) return null
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length
  return Math.round(avg * 10) / 10
}

/** Derive the grid-facing { rating, year } from a (possibly null) cached Metadata. */
export function ratingInfo(meta: Metadata | null): RatingInfo {
  return { rating: averageRating(meta?.ratings), year: meta?.year ?? null }
}

/** Synchronous read of already-cached ratings for the given paths (no network). */
export function currentRatings(paths: string[]): Record<string, RatingInfo> {
  const out: Record<string, RatingInfo> = {}
  for (const path of paths) {
    const meta = cache.load(path)
    if (meta) out[path] = ratingInfo(meta)
  }
  return out
}

// A generation counter so a newer sweep (e.g. after switching folders) cancels any in-flight one.
let gen = 0

// Count of in-flight user-initiated (foreground) fetches. While > 0 the background sweep pauses so
// opening a movie stays as fast as it was before the prefetch existed.
let foreground = 0
export function beginForeground(): void {
  foreground++
}
export function endForeground(): void {
  if (foreground > 0) foreground--
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Cancel any in-flight sweep (e.g. when the user turns background caching off). */
export function cancelPrefetch(): void {
  gen++
}

type Send = (channel: string, payload: unknown) => void

/**
 * Kick off a background sweep resolving every movie's rating, emitting a `ratingResolved` event per
 * movie and `ratingsProgress` updates for the sidebar bar. Fire-and-forget; cancels on the next call.
 * The heavy work (cache scan + network) runs off the critical path so listMovies returns immediately.
 */
export function startPrefetch(paths: string[], send: Send): void {
  const myGen = ++gen
  void sweep(myGen, paths, send)
}

async function sweep(myGen: number, paths: string[], send: Send): Promise<void> {
  // No key, or background caching disabled → ratings are cached lazily when a movie is opened.
  if (!loadKeys().tmdb || !loadSettings().prefetchRatings) {
    send(EVT.ratingsProgress, { done: 0, total: 0, running: false })
    return
  }

  // Hold off so the visible cover load and any first clicks get the network first.
  await sleep(START_DELAY_MS)
  if (myGen !== gen) return

  // Only movies whose metadata isn't cached yet need fetching — cached ratings are delivered
  // instantly to the renderer via getRatings/hydrate, so re-emitting them here would just flood it.
  const todo: string[] = []
  for (const p of paths) {
    if (myGen !== gen) return
    if (!cache.load(p)) todo.push(p)
  }
  const total = todo.length
  if (total === 0) {
    send(EVT.ratingsProgress, { done: 0, total: 0, running: false })
    return
  }

  let done = 0
  let i = 0
  send(EVT.ratingsProgress, { done, total, running: true })

  const worker = async (): Promise<void> => {
    while (i < todo.length) {
      if (myGen !== gen) return
      // Yield the field entirely while the user is opening a movie.
      while (foreground > 0 && myGen === gen) await sleep(FG_WAIT_MS)
      if (myGen !== gen) return
      const path = todo[i++]
      let info: RatingInfo = { rating: null, year: null }
      try {
        // Always awaits a network match → naturally yields the event loop to user actions.
        info = ratingInfo(await getMetadata(path))
      } catch (exc) {
        log.debug('Rating prefetch failed for', path, String(exc))
      }
      if (myGen !== gen) return
      done++
      send(EVT.ratingResolved, { path, rating: info.rating, year: info.year })
      send(EVT.ratingsProgress, { done, total, running: done < total })
      await sleep(STEP_DELAY_MS)
    }
  }

  await Promise.all(Array.from({ length: PREFETCH_WORKERS }, () => worker()))
  if (myGen === gen) send(EVT.ratingsProgress, { done, total, running: false })
}
