// Metadata orchestration: parse -> fingerprint -> match -> enrich -> cache. Port of metadata.py.
// Runs only when a movie is selected; results + artwork are cached so repeats are instant/offline.

import {
  TMDB_BACKDROP_SIZE,
  TMDB_COLLECTION_POSTER_SIZE,
  TMDB_COVER_SIZE,
  TMDB_POSTER_SIZE,
  loadKeys
} from './config'
import * as cache from './cache'
import * as parsing from './parsing'
import * as matching from './matching'
import * as trailers from './trailers'
import { probe } from './fingerprint'
import { tmdb, omdb } from './providers'
import { log } from './logging'
import type { Collection, CoverResult, Fingerprint, Metadata, Parsed } from '../../shared/types'

const TOP_N = 6
const MAX_COLLECTION = 24

/** Run each query variant against TMDb and merge the hits, deduped by movie id (order-stable). */
async function searchVariants(variants: string[], tmdbKey: string, year?: number | null): Promise<any[]> {
  const merged: any[] = []
  const seen = new Set<number>()
  for (const query of variants) {
    let hits: any[]
    try {
      hits = await tmdb.search(query, tmdbKey, year ?? undefined)
    } catch (exc) {
      log.debug(`TMDb search failed for "${query}":`, String(exc))
      continue
    }
    for (const hit of hits) {
      if (hit && typeof hit.id === 'number' && !seen.has(hit.id)) {
        seen.add(hit.id)
        merged.push(hit)
      }
    }
  }
  return merged
}

export async function getMetadata(path: string, refresh = false): Promise<Metadata> {
  if (!refresh) {
    const cached = cache.load(path)
    if (cached) return attachImages(path, cached)
  }

  const keys = loadKeys()
  const parsed = parsing.parse(path)
  const fp = probe(path)

  if (!keys.tmdb) {
    return {
      matched: false,
      confidence: 0,
      title: parsed.title,
      year: parsed.year,
      needs_key: true,
      message:
        'Add your free TMDb API key to enable online matching ' +
        '(set TMDB_API_KEY, or tmdb_api_key in config.json).',
      parsed,
      fingerprint: fp
    }
  }

  const meta = await matchAndBuild(path, parsed, fp, keys.tmdb)
  cache.save(path, meta)
  return attachImages(path, meta)
}

/** Lightweight grid cover: cached poster, else one TMDb search + poster download. */
export async function getCover(path: string): Promise<CoverResult> {
  const cached = cache.imageDataUri(path, 'poster.jpg')
  if (cached) return { poster: cached }

  const keys = loadKeys()
  if (!keys.tmdb) return {}
  const parsed = parsing.parse(path)

  let results: any[]
  try {
    results = await tmdb.search(parsed.title, keys.tmdb, parsed.year)
    if (!results.length && parsed.year) results = await tmdb.search(parsed.title, keys.tmdb)
  } catch (exc) {
    log.debug(`Cover search failed for ${parsed.title}:`, String(exc))
    return {}
  }
  if (!results.length) return {}

  const best = results.reduce((a, b) => (matching.prescore(b, parsed) > matching.prescore(a, parsed) ? b : a))
  if (matching.titleRatio(parsed.title, best) < 0.6 || !best.poster_path) return {}
  try {
    const data = await tmdb.download(tmdb.imageUrl(best.poster_path, TMDB_COVER_SIZE))
    cache.saveImage(path, 'poster.jpg', data)
  } catch (exc) {
    log.debug('Cover download failed:', String(exc))
    return {}
  }
  return { poster: cache.imageDataUri(path, 'poster.jpg') }
}

async function matchAndBuild(path: string, parsed: Parsed, fp: Fingerprint, tmdbKey: string): Promise<Metadata> {
  const base: Metadata = {
    matched: false,
    confidence: 0,
    parsed,
    fingerprint: fp,
    title: parsed.title,
    year: parsed.year,
    trailer: trailers.findTrailer(path)
  }

  const variants = parsing.titleVariants(parsed.title)
  let results = await searchVariants(variants, tmdbKey, parsed.year)
  // Fall back to a year-less search when a year-constrained query finds nothing.
  if (!results.length && parsed.year) results = await searchVariants(variants, tmdbKey)
  if (!results.length) return base

  const embedded = fp.embedded_title
  const ranked = [...results]
    .sort((a, b) => matching.prescore(b, parsed, embedded) - matching.prescore(a, parsed, embedded))
    .slice(0, TOP_N)

  let best: any = null
  let bestScore = -1.0
  for (const candidate of ranked) {
    let detail: any
    try {
      detail = await tmdb.details(candidate.id, tmdbKey)
    } catch (exc) {
      log.debug(`TMDb details failed for ${candidate.id}:`, String(exc))
      continue
    }
    const score = matching.finalScore(detail, parsed, fp)
    if (score > bestScore) {
      best = detail
      bestScore = score
    }
  }

  if (!best) return base
  return buildMeta(path, parsed, fp, best, bestScore, tmdbKey)
}

async function buildMeta(
  path: string,
  parsed: Parsed,
  fp: Fingerprint,
  d: any,
  confidence: number,
  tmdbKey: string
): Promise<Metadata> {
  const imdbId = (d.external_ids && d.external_ids.imdb_id) || ''
  const ratings: Record<string, string> = {}
  let countries = (d.production_countries ?? []).filter((c: any) => c.name).map((c: any) => c.name)

  const enrich = imdbId ? await omdb.fetchByImdb(imdbId) : null
  if (enrich) {
    Object.assign(ratings, enrich.ratings)
    if (enrich.country && !countries.length) countries = [enrich.country]
  }
  if (d.vote_average) ratings.tmdb = `${Math.round(d.vote_average * 10) / 10}/10`

  return {
    matched: true,
    confidence: Math.round(confidence * 1000) / 1000,
    title: d.title || parsed.title,
    year: matching.candidateYear(d) ?? parsed.year,
    tagline: d.tagline || '',
    overview: d.overview || '',
    genres: (d.genres ?? []).filter((g: any) => g.name).map((g: any) => g.name),
    runtime: d.runtime,
    countries,
    ratings,
    ids: { tmdb: d.id, imdb: imdbId },
    parsed,
    fingerprint: fp,
    poster_file: await cacheImage(path, d.poster_path, TMDB_POSTER_SIZE, 'poster.jpg', tmdbKey),
    backdrop_file: await cacheImage(path, d.backdrop_path, TMDB_BACKDROP_SIZE, 'backdrop.jpg', tmdbKey),
    collection: await buildCollection(path, d.belongs_to_collection, tmdbKey),
    trailer: trailers.findTrailer(path)
  }
}

async function buildCollection(path: string, collectionRef: any, tmdbKey: string): Promise<Collection | null> {
  if (!collectionRef) return null
  let data: any
  try {
    data = await tmdb.collection(collectionRef.id, tmdbKey)
  } catch (exc) {
    log.debug('Collection fetch failed:', String(exc))
    return { name: collectionRef.name || '', parts: [] }
  }

  const items = [...(data.parts ?? [])].sort((a: any, b: any) =>
    (a.release_date || '').localeCompare(b.release_date || '')
  )
  const parts = []
  for (let i = 0; i < Math.min(items.length, MAX_COLLECTION); i++) {
    const part = items[i]
    const posterFile = await cacheImage(path, part.poster_path, TMDB_COLLECTION_POSTER_SIZE, `coll_${i}.jpg`, tmdbKey)
    parts.push({ title: part.title || '', year: matching.candidateYear(part), poster_file: posterFile })
  }
  return { name: data.name || collectionRef.name || '', parts }
}

async function cacheImage(
  path: string,
  tmdbPath: string | undefined,
  size: string,
  filename: string,
  tmdbKey: string
): Promise<string> {
  if (!tmdbPath) return ''
  try {
    const data = await tmdb.download(tmdb.imageUrl(tmdbPath, size))
    return cache.saveImage(path, filename, data)
  } catch (exc) {
    log.debug(`Image download failed (${filename}):`, String(exc))
    return ''
  }
}

/** Return a copy with base64 data URIs for cached images (for the frontend). */
function attachImages(path: string, meta: Metadata): Metadata {
  const out: Metadata = { ...meta }
  out.poster = cache.imageDataUri(path, meta.poster_file || '')
  out.backdrop = cache.imageDataUri(path, meta.backdrop_file || '')
  const collection = meta.collection
  if (collection && collection.parts && collection.parts.length) {
    out.collection = {
      ...collection,
      parts: collection.parts.map((part) => ({
        ...part,
        poster: cache.imageDataUri(path, part.poster_file || '')
      }))
    }
  }
  return out
}
