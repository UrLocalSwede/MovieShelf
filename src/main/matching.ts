// Scoring TMDb candidates against the parsed filename + media fingerprint. Port of matching.py.
// _ratio uses a faithful port of Python difflib.SequenceMatcher.ratio() (Ratcliff/Obershelp),
// because the scoring weights and UI confidence thresholds were calibrated against it — a
// Dice-coefficient substitute would shift results.

import type { Fingerprint, Parsed } from '../../shared/types'

interface Candidate {
  title?: string
  original_title?: string
  name?: string
  release_date?: string
  popularity?: number
  runtime?: number | null
  original_language?: string
  vote_average?: number
  [k: string]: unknown
}

// --- difflib SequenceMatcher.ratio() port (no autojunk; titles are short) -------------------
function matchingCharCount(a: string, b: string): number {
  const b2j = new Map<string, number[]>()
  for (let j = 0; j < b.length; j++) {
    const arr = b2j.get(b[j])
    if (arr) arr.push(j)
    else b2j.set(b[j], [j])
  }

  function longestMatch(alo: number, ahi: number, blo: number, bhi: number): [number, number, number] {
    let besti = alo
    let bestj = blo
    let bestk = 0
    let j2len = new Map<number, number>()
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map<number, number>()
      const indices = b2j.get(a[i])
      if (indices) {
        for (const j of indices) {
          if (j < blo) continue
          if (j >= bhi) break
          const k = (j2len.get(j - 1) || 0) + 1
          newj2len.set(j, k)
          if (k > bestk) {
            besti = i - k + 1
            bestj = j - k + 1
            bestk = k
          }
        }
      }
      j2len = newj2len
    }
    return [besti, bestj, bestk]
  }

  let matches = 0
  const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]]
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number]
    const [i, j, k] = longestMatch(alo, ahi, blo, bhi)
    if (k > 0) {
      matches += k
      if (alo < i && blo < j) queue.push([alo, i, blo, j])
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi])
    }
  }
  return matches
}

function seqRatio(a: string, b: string): number {
  const total = a.length + b.length
  if (total === 0) return 1.0
  return (2.0 * matchingCharCount(a, b)) / total
}

/** Public Ratcliff/Obershelp similarity (matches Python difflib), for reuse (e.g. trailers). */
export function similarity(a: string, b: string): number {
  return seqRatio(a, b)
}

// --- scoring --------------------------------------------------------------------------------
function norm(text: unknown): string {
  return String(text ?? '').trim().toLowerCase()
}

function ratio(a: string, b: string): number {
  if (!a || !b) return 0.0
  return seqRatio(norm(a), norm(b))
}

export function titleRatio(parsedTitle: string, candidate: Candidate): number {
  const names = [candidate.title, candidate.original_title, candidate.name]
  let best = 0.0
  for (const n of names) {
    if (n) best = Math.max(best, ratio(parsedTitle, n))
  }
  return best
}

export function candidateYear(candidate: Candidate): number | null {
  const date = candidate.release_date || ''
  if (date.length >= 4 && /^\d{4}$/.test(date.slice(0, 4))) return parseInt(date.slice(0, 4), 10)
  return null
}

function yearScore(parsedYear: number | null | undefined, candYear: number | null): number {
  if (!parsedYear || !candYear) return 0.5 // neutral when unknown
  const diff = Math.abs(parsedYear - candYear)
  if (diff === 0) return 1.0
  if (diff === 1) return 0.6
  return 0.0
}

function runtimeScore(fpMinutes: number | null | undefined, candRuntime: number | null | undefined): number {
  if (!fpMinutes || !candRuntime) return 0.5 // neutral when unknown
  const diff = Math.abs(fpMinutes - candRuntime)
  if (diff <= 3) return 1.0
  if (diff <= 8) return 0.7
  if (diff <= 15) return 0.4
  return 0.1
}

/** Cheap ranking of search hits using only title + year (no extra API calls). */
export function prescore(candidate: Candidate, parsed: Parsed): number {
  const t = titleRatio(parsed.title || '', candidate)
  const y = yearScore(parsed.year, candidateYear(candidate))
  const pop = Math.min((candidate.popularity || 0) / 100.0, 1.0)
  return 0.78 * t + 0.2 * y + 0.02 * pop
}

/** Full score for a fetched detail record, including runtime + language signals. */
export function finalScore(details: Candidate, parsed: Parsed, fp: Fingerprint): number {
  const t = titleRatio(parsed.title || '', details)
  const y = yearScore(parsed.year, candidateYear(details))
  const r = runtimeScore(fp.duration_min, details.runtime)

  let lang = 0.5
  const parsedLang = norm(parsed.language)
  if (parsedLang && details.original_language) {
    lang = parsedLang.startsWith(norm(details.original_language)) ? 1.0 : 0.3
  }

  return round(0.6 * t + 0.18 * y + 0.17 * r + 0.05 * lang, 4)
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}
