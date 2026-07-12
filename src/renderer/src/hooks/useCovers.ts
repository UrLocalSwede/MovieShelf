import { useCallback, useRef, useState } from 'react'
import { api, isError } from '../api'
import type { Movie } from '@shared/types'

// Lazy grid cover loading with a 4-worker pool and a generation counter that cancels
// in-flight loads when the folder changes. Ported from app.js:ensureCovers.
export function useCovers(): {
  covers: Record<string, string>
  ensure: (movies: Movie[]) => void
  bumpGeneration: () => void
} {
  const [covers, setCovers] = useState<Record<string, string>>({})
  const attempted = useRef<Set<string>>(new Set())
  const gen = useRef(0)

  const bumpGeneration = useCallback(() => {
    gen.current++
  }, [])

  const ensure = useCallback((movies: Movie[]) => {
    const myGen = gen.current
    const todo = movies.filter((m) => !attempted.current.has(m.path))
    let i = 0
    const worker = async (): Promise<void> => {
      while (i < todo.length) {
        if (myGen !== gen.current) return
        const movie = todo[i++]
        attempted.current.add(movie.path)
        try {
          const res = await api.getCover(movie.path)
          if (myGen !== gen.current) return
          if (!isError(res) && res.poster) {
            const poster = res.poster
            setCovers((prev) => ({ ...prev, [movie.path]: poster }))
          }
        } catch {
          // skip this cover
        }
      }
    }
    void Promise.all([worker(), worker(), worker(), worker()])
  }, [])

  return { covers, ensure, bumpGeneration }
}
