import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isError } from '../api'
import type { RatingInfo, RatingsProgress } from '@shared/types'

const IDLE: RatingsProgress = { done: 0, total: 0, running: false }
const FLUSH_MS = 300

// Holds the per-movie average ratings (path -> { rating, year }) streamed from the main-process
// background prefetch, plus its progress for the sidebar bar. `hydrate` seeds already-cached values
// on load; `reset` clears the map when the library changes.
export function useRatings(): {
  ratings: Record<string, RatingInfo>
  progress: RatingsProgress
  hydrate: (paths: string[]) => void
  reset: () => void
} {
  const [ratings, setRatings] = useState<Record<string, RatingInfo>>({})
  const [progress, setProgress] = useState<RatingsProgress>(IDLE)

  // Coalesce the stream of per-movie resolutions into one state update per FLUSH_MS so a fast
  // prefetch doesn't re-render (and re-sort) the grid hundreds of times.
  const pending = useRef<Record<string, RatingInfo>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const flush = (): void => {
      timer.current = null
      const batch = pending.current
      pending.current = {}
      setRatings((prev) => ({ ...prev, ...batch }))
    }
    const offResolved = window.events?.onRatingResolved((p) => {
      pending.current[p.path] = { rating: p.rating, year: p.year }
      if (timer.current === null) timer.current = setTimeout(flush, FLUSH_MS)
    })
    const offProgress = window.events?.onRatingsProgress((p) => setProgress(p))
    return () => {
      offResolved?.()
      offProgress?.()
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])

  const hydrate = useCallback((paths: string[]): void => {
    if (!paths.length) return
    void (async () => {
      const res = await api.getRatings(paths)
      if (!isError(res)) setRatings((prev) => ({ ...prev, ...res }))
    })()
  }, [])

  const reset = useCallback((): void => {
    pending.current = {}
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setRatings({})
    setProgress(IDLE)
  }, [])

  return { ratings, progress, hydrate, reset }
}
