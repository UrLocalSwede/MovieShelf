import { useMemo, useState } from 'react'
import { FilmMark, ReverseIcon } from '../icons'
import type { Movie, RatingInfo } from '@shared/types'

interface Props {
  movies: Movie[]
  filtered: Movie[]
  query: string
  covers: Record<string, string>
  ratings: Record<string, RatingInfo>
  selectedPath: string | null
  scanning: boolean
  onSelect: (movie: Movie) => void
}

type SortKey = 'title' | 'rating' | 'year'

const SORT_LABELS: Record<SortKey, string> = {
  title: 'A to Z',
  rating: 'Ratings',
  year: 'Release date'
}

// Color band for the poster badge: 0–4.5 red, 4.6–6.5 yellow, 6.6–10 green.
function band(rating: number): string {
  if (rating <= 4.5) return 'rb-low'
  if (rating <= 6.5) return 'rb-mid'
  return 'rb-high'
}

export function Grid({
  movies,
  filtered,
  query,
  covers,
  ratings,
  selectedPath,
  scanning,
  onSelect
}: Props): React.JSX.Element {
  const empty = movies.length === 0
  const filteredEmpty = movies.length > 0 && filtered.length === 0

  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [reverse, setReverse] = useState(false)

  // Sort the (already search-filtered) list. Rating/year default to descending (best/newest first);
  // the reverse toggle flips the order but movies still awaiting a rating/year always sort last.
  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = reverse ? -1 : 1
    if (sortKey === 'title') {
      arr.sort((a, b) => dir * a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      return arr
    }
    const val = (m: Movie): number | null =>
      sortKey === 'rating' ? ratings[m.path]?.rating ?? null : ratings[m.path]?.year ?? null
    arr.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va === null && vb === null) return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      if (va === null) return 1
      if (vb === null) return -1
      return dir * (vb - va)
    })
    return arr
  }, [filtered, ratings, sortKey, reverse])

  return (
    <div className="grid-scroll">
      {!scanning && !empty && (
        <div className="sort-bar">
          <span className="sort-label">Sort</span>
          <select
            className="select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            className={'sort-reverse' + (reverse ? ' active' : '')}
            title={reverse ? 'Reverse order (on)' : 'Reverse order'}
            aria-pressed={reverse}
            onClick={() => setReverse((r) => !r)}
          >
            <ReverseIcon />
          </button>
        </div>
      )}
      <div className="grid">
        {scanning ? (
          <div className="grid-loading">
            <span className="spin-inline" />
            Scanning library…
          </div>
        ) : filteredEmpty ? (
          <div className="grid-loading">No titles match “{query}”.</div>
        ) : (
          sorted.map((movie) => {
            const cover = covers[movie.path]
            const rating = ratings[movie.path]?.rating ?? null
            return (
              <div
                key={movie.path}
                className={'movie' + (selectedPath === movie.path ? ' active' : '')}
                onClick={() => onSelect(movie)}
              >
                <div className="movie-art">
                  {rating !== null && (
                    <span className={'rating-badge ' + band(rating)}>{rating.toFixed(1)}</span>
                  )}
                  {cover ? <img className="movie-cover" src={cover} alt="" /> : <FilmMark />}
                </div>
                <div className="movie-title">{movie.title}</div>
              </div>
            )
          })
        )}
      </div>
      {empty && !scanning && (
        <div className="empty">
          <div className="empty-title">No movies here yet</div>
          <div className="empty-text">
            Add a folder containing <code>.mkv</code> or <code>.mp4</code> files.
          </div>
        </div>
      )}
    </div>
  )
}
