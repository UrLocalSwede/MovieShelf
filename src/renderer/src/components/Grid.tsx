import { FilmMark } from '../icons'
import type { Movie } from '@shared/types'

interface Props {
  movies: Movie[]
  filtered: Movie[]
  query: string
  covers: Record<string, string>
  selectedPath: string | null
  scanning: boolean
  onSelect: (movie: Movie) => void
}

export function Grid({ movies, filtered, query, covers, selectedPath, scanning, onSelect }: Props): React.JSX.Element {
  const empty = movies.length === 0
  const filteredEmpty = movies.length > 0 && filtered.length === 0

  return (
    <div className="grid-scroll">
      <div className="grid">
        {scanning ? (
          <div className="grid-loading">
            <span className="spin-inline" />
            Scanning library…
          </div>
        ) : filteredEmpty ? (
          <div className="grid-loading">No titles match “{query}”.</div>
        ) : (
          filtered.map((movie) => {
            const cover = covers[movie.path]
            return (
              <div
                key={movie.path}
                className={'movie' + (selectedPath === movie.path ? ' active' : '')}
                onClick={() => onSelect(movie)}
              >
                <div className="movie-art">{cover ? <img className="movie-cover" src={cover} alt="" /> : <FilmMark />}</div>
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
