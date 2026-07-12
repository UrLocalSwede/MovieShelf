import { useState } from 'react'
import { FilmMark } from '../icons'
import type { Metadata, Movie, SubtitleEntry } from '@shared/types'

const RATING_LABELS: Record<string, string> = {
  imdb: 'IMDb',
  rotten_tomatoes: 'RT',
  metacritic: 'Metacritic',
  tmdb: 'TMDb'
}

interface Props {
  open: boolean
  movie: Movie | null
  meta: Metadata | null
  subtitles: SubtitleEntry[]
  loading: boolean
  loadingText: string
  playStatus: string
  playStatusError: boolean
  onClose: () => void
  onPlay: (subtitlePath: string) => void
  onStop: () => void
  onTrailer: () => void
  onRematch: () => void
}

function MatchNote({ meta }: { meta: Metadata }): React.JSX.Element {
  if (!meta.matched) return <span className="warn">No online match — Re-match?</span>
  const pct = Math.round((meta.confidence || 0) * 100)
  const label = pct >= 85 ? 'Strong match' : pct >= 60 ? 'Likely match' : 'Low confidence'
  return <span className={pct >= 60 ? 'confidence' : 'warn'}>{`${label} · ${pct}%`}</span>
}

export function DetailModal(props: Props): React.JSX.Element {
  const { open, movie, meta, subtitles, loading, loadingText, playStatus, playStatusError } = props
  const [subtitle, setSubtitle] = useState('')

  // Reset the subtitle picker whenever the movie changes.
  const key = movie?.path ?? ''
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setSubtitle('')
  }

  const matched = meta && !meta.error && !meta.needs_key
  const ratings = meta?.ratings || {}
  const year = matched && meta?.year ? ` (${meta.year})` : ''
  const title = meta?.needs_key
    ? meta.parsed?.title || movie?.title || '—'
    : (meta?.title ?? movie?.title ?? '—') + year

  const posterUrl = matched ? meta?.poster : undefined

  return (
    <>
      <div className={'scrim' + (open ? '' : ' hidden')} onClick={props.onClose} />
      <section className={'detail' + (open ? ' open' : '')} aria-hidden={!open}>
        <div
          className="backdrop"
          style={{ backgroundImage: matched && meta?.backdrop ? `url("${meta.backdrop}")` : undefined }}
        />
        <button className="detail-close" title="Close (Esc)" onClick={props.onClose}>
          ×
        </button>

        <div className="detail-body">
          <div className="detail-head">
            <div className="poster-wrap">
              {posterUrl ? (
                <img className="poster" src={posterUrl} alt="" />
              ) : (
                <div className="poster-fallback">
                  <FilmMark />
                </div>
              )}
            </div>

            <div className="detail-main">
              <h2 className="d-title">{title}</h2>
              <div className="d-tagline">{matched ? meta?.tagline : ''}</div>

              {meta?.needs_key ? (
                <p className="d-overview">{meta.message}</p>
              ) : meta?.error ? (
                <p className="d-overview">{meta.error}</p>
              ) : (
                matched &&
                meta && (
                  <>
                    <div className="d-facts">
                      {meta.runtime ? <span>{meta.runtime} min</span> : null}
                      {meta.countries && meta.countries.length ? <span>{meta.countries.join(', ')}</span> : null}
                      {meta.fingerprint?.resolution ? <span>{meta.fingerprint.resolution}</span> : null}
                      <MatchNote meta={meta} />
                    </div>

                    <div className="ratings">
                      {(['imdb', 'rotten_tomatoes', 'metacritic', 'tmdb'] as const).map((k) =>
                        ratings[k] ? (
                          <div className="rating" key={k}>
                            <span className="src">{RATING_LABELS[k]}</span>
                            <span className="val">{ratings[k]}</span>
                          </div>
                        ) : null
                      )}
                    </div>

                    <div className="chips">
                      {(meta.genres || []).map((g) => (
                        <span className="chip" key={g}>
                          {g}
                        </span>
                      ))}
                    </div>

                    <p className="d-overview">{meta.overview || 'No description available.'}</p>
                  </>
                )
              )}

              <div className="controls">
                <div className="control-row">
                  <label className="field-label" htmlFor="subtitle">
                    Subtitle
                  </label>
                  <select
                    id="subtitle"
                    className="select"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  >
                    <option value="">Auto</option>
                    {subtitles.map((s) => (
                      <option value={s.path} key={s.path}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="buttons">
                  <button className="btn-play" onClick={() => props.onPlay(subtitle || (subtitles[0]?.path ?? ''))}>
                    ▶ Play
                  </button>
                  <button className="btn-ghost" onClick={props.onStop}>
                    Stop
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={!meta?.trailer?.path}
                    title={meta?.trailer?.name || ''}
                    onClick={props.onTrailer}
                  >
                    {meta?.trailer?.path ? 'Watch trailer' : 'No trailer available'}
                  </button>
                  <button className="btn-ghost" title="Search again" onClick={props.onRematch}>
                    Re-match
                  </button>
                </div>
                <div className={'play-status' + (playStatusError ? ' error' : '')}>{playStatus}</div>
              </div>
            </div>
          </div>

          {matched && meta?.collection && meta.collection.parts.length > 0 && (
            <div className="collection">
              <div className="card-label">{meta.collection.name || 'Collection'}</div>
              <div className="collection-row">
                {meta.collection.parts.map((part, i) => (
                  <div
                    className={'coll-item' + (meta.title && part.title === meta.title ? ' current' : '')}
                    key={i}
                  >
                    <div className="coll-art">
                      {part.poster ? (
                        <img src={part.poster} alt={part.title || ''} />
                      ) : (
                        <div className="ph">{part.title || '?'}</div>
                      )}
                    </div>
                    <div className="coll-title">{part.title || ''}</div>
                    {part.year ? <div className="coll-year">{part.year}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={'detail-loading' + (loading ? ' show' : '')}>
          <div className="spinner" />
          <div className="loading-text">{loadingText}</div>
        </div>
      </section>
    </>
  )
}
