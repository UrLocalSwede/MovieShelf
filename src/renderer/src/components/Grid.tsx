import { useEffect, useMemo, useState } from 'react'
import { BackIcon, FilmMark, ReverseIcon } from '../icons'
import { CollectionBanners } from './CollectionBanners'
import type { CollectionGroup, Movie, RatingInfo } from '@shared/types'

interface Props {
  movies: Movie[]
  filtered: Movie[]
  query: string
  mode: 'library' | 'collections'
  collections: CollectionGroup[]
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
  mode,
  collections,
  covers,
  ratings,
  selectedPath,
  scanning,
  onSelect
}: Props): React.JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [reverse, setReverse] = useState(false)
  const [activeCollection, setActiveCollection] = useState<CollectionGroup | null>(null)

  // Leaving the Collections tab returns to the banner list; keep the open collection in sync with
  // the latest groups otherwise (drop it when it's gone after a folder switch/refresh).
  useEffect(() => {
    if (mode !== 'collections') {
      if (activeCollection) setActiveCollection(null)
      return
    }
    if (!activeCollection) return
    const fresh = collections.find((c) => c.key === activeCollection.key)
    if (!fresh) setActiveCollection(null)
    else if (fresh !== activeCollection) setActiveCollection(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, mode])

  // Inside a collection the grid is restricted to that franchise's movies, still honoring the
  // search box; the library tab shows the app-level search-filtered list.
  const source = useMemo(() => {
    if (!activeCollection) return filtered
    const q = query.toLowerCase()
    return q ? activeCollection.movies.filter((m) => m.title.toLowerCase().includes(q)) : activeCollection.movies
  }, [activeCollection, filtered, query])

  const empty = !activeCollection && movies.length === 0
  const filteredEmpty = source.length === 0 && !empty

  // Sort the (already filtered) list. Rating/year default to descending (best/newest first);
  // the reverse toggle flips the order but movies still awaiting a rating/year always sort last.
  const sorted = useMemo(() => {
    const arr = [...source]
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
  }, [source, ratings, sortKey, reverse])

  // Collections tab, not yet drilled into a franchise: show only the themed banners.
  // (Placed after all hooks so hook order stays stable across mode/collection changes.)
  if (mode === 'collections' && !activeCollection) {
    return (
      <div className="grid-scroll">
        {scanning ? (
          <div className="grid-loading">
            <span className="spin-inline" />
            Scanning library…
          </div>
        ) : collections.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No collections yet</div>
            <div className="empty-text">
              Add movies from a franchise (e.g. the MCU, Harry Potter) and they’ll be grouped here.
            </div>
          </div>
        ) : (
          <CollectionBanners collections={collections} onOpen={setActiveCollection} />
        )}
      </div>
    )
  }

  return (
    <div className="grid-scroll">
      {activeCollection && (
        <div
          className="collection-header"
          style={{
            backgroundImage: `linear-gradient(135deg, ${activeCollection.colors[0]} 0%, ${activeCollection.colors[1]} 100%)`
          }}
        >
          <button className="collection-back" title="Back to collections" onClick={() => setActiveCollection(null)}>
            <BackIcon />
            <span>Collections</span>
          </button>
          <span className="ch-title">{activeCollection.title}</span>
          <span className="ch-count">{activeCollection.movies.length} movies</span>
        </div>
      )}
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
