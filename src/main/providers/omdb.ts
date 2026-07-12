// OMDb client — enriches a TMDb match with IMDb / Rotten Tomatoes / Metacritic ratings.
// Port of providers/omdb.py.

import { loadKeys } from '../config'
import { log } from '../logging'
import type { Ratings } from '../../../shared/types'

const OMDB_URL = 'https://www.omdbapi.com/'
const TIMEOUT_MS = 20_000

function ratingsOf(payload: any): Ratings {
  const out: Ratings = {}
  for (const entry of payload.Ratings ?? []) {
    const source = entry.Source
    const value = entry.Value
    if (source === 'Internet Movie Database') out.imdb = value
    else if (source === 'Rotten Tomatoes') out.rotten_tomatoes = value
    else if (source === 'Metacritic') out.metacritic = value
  }
  return out
}

export interface OmdbEnrich {
  ratings: Ratings
  country: string
  runtime: string
  imdb_votes: string
}

/** {ratings, country, runtime, imdb_votes} for an IMDb id, or null on failure. */
export async function fetchByImdb(imdbId: string): Promise<OmdbEnrich | null> {
  if (!imdbId) return null
  try {
    const params = new URLSearchParams({ i: imdbId, apikey: loadKeys().omdb })
    const res = await fetch(`${OMDB_URL}?${params.toString()}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`)
    const payload = await res.json()
    if (payload.Response !== 'True') return null
    return {
      ratings: ratingsOf(payload),
      country: payload.Country || '',
      runtime: payload.Runtime || '',
      imdb_votes: payload.imdbVotes || ''
    }
  } catch (exc) {
    log.debug(`OMDb lookup failed for ${imdbId}:`, String(exc))
    return null
  }
}
