// TheMovieDB (TMDb) client — search, details, collections, images. Port of providers/tmdb.py.

import { TMDB_API_BASE, TMDB_IMAGE_BASE } from '../config'

const TIMEOUT_MS = 20_000

async function get(endpoint: string, key: string, params: Record<string, string> = {}): Promise<any> {
  const search = new URLSearchParams({ ...params, api_key: key })
  const url = `${TMDB_API_BASE}${endpoint}?${search.toString()}`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`TMDb ${endpoint} HTTP ${res.status}`)
  return res.json()
}

export async function search(title: string, key: string, year?: number | null): Promise<any[]> {
  const params: Record<string, string> = { query: title, include_adult: 'false' }
  if (year) params.year = String(year)
  const data = await get('/search/movie', key, params)
  return data.results ?? []
}

export async function details(movieId: number, key: string): Promise<any> {
  return get(`/movie/${movieId}`, key, {
    append_to_response: 'images,release_dates,external_ids',
    include_image_language: 'en,null'
  })
}

export async function collection(collectionId: number, key: string): Promise<any> {
  return get(`/collection/${collectionId}`, key)
}

export function imageUrl(path: string, size: string): string {
  if (!path) return ''
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`TMDb image HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
