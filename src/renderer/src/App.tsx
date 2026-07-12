import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isError } from './api'
import { BrandMark, SearchIcon } from './icons'
import { Sidebar } from './components/Sidebar'
import { Grid } from './components/Grid'
import { DetailModal } from './components/DetailModal'
import { PlayerPane } from './components/PlayerPane'
import { SettingsPage } from './components/SettingsPage'
import { UpdateBanner } from './components/UpdateBanner'
import { useCovers } from './hooks/useCovers'
import { useRatings } from './hooks/useRatings'
import type { ChooseFolderCancelled, Metadata, Movie, MoviesPayload, SubtitleEntry } from '@shared/types'

const KEY_MAP: Record<string, string> = {
  ' ': 'SPACE',
  ArrowRight: 'RIGHT',
  ArrowLeft: 'LEFT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  m: 'm'
}

export default function App(): React.JSX.Element {
  const [movies, setMovies] = useState<Movie[]>([])
  const [current, setCurrent] = useState('')
  const [folders, setFolders] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(true)

  const [selected, setSelected] = useState<Movie | null>(null)
  const [meta, setMeta] = useState<Metadata | null>(null)
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')

  const [playing, setPlaying] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [npTitle, setNpTitle] = useState('Now playing')
  const [playStatus, setPlayStatus] = useState('')
  const [playStatusError, setPlayStatusError] = useState(false)

  const { covers, ensure, bumpGeneration } = useCovers()
  const { ratings, progress, hydrate, reset: resetRatings } = useRatings()
  const videoRegionRef = useRef<HTMLDivElement>(null)
  const detailToken = useRef(0)

  // Mirror flags into refs so the mount-only listeners read current values.
  const playingRef = useRef(playing)
  const fullscreenRef = useRef(fullscreen)
  const detailOpenRef = useRef(detailOpen)
  const settingsOpenRef = useRef(settingsOpen)
  playingRef.current = playing
  fullscreenRef.current = fullscreen
  detailOpenRef.current = detailOpen
  settingsOpenRef.current = settingsOpen

  const filtered = movies.filter((m) => m.title.toLowerCase().includes(query.trim().toLowerCase()))

  // ---- data loading --------------------------------------------------------
  const loadMovies = useCallback(
    async (payload?: MoviesPayload) => {
      bumpGeneration()
      resetRatings()
      if (!payload) setScanning(true)
      const data = payload ?? (await api.listMovies())
      setScanning(false)
      if (isError(data)) {
        console.error(data.error)
        setMovies([])
        return
      }
      const list = data.movies || []
      setMovies(list)
      setCurrent(data.folder || '')
      setFolders(data.folders || [])
      hydrate(list.map((m) => m.path)) // seed ratings already cached on disk
    },
    [bumpGeneration, resetRatings, hydrate]
  )

  useEffect(() => {
    void loadMovies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!scanning) ensure(filtered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies, query, scanning])

  // ---- detail --------------------------------------------------------------
  const syncRegion = useCallback(async () => {
    if (!playingRef.current || fullscreenRef.current) return
    const el = videoRegionRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    await api.setPlayerRegion(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height))
  }, [])

  const closeDetail = useCallback(() => {
    detailToken.current++
    setDetailOpen(false)
    setLoading(false)
    setSelected(null)
    setMeta(null)
    if (playingRef.current) {
      void api.showVideo()
      void syncRegion()
    }
  }, [syncRegion])

  const selectMovie = useCallback(
    async (movie: Movie) => {
      setSelected(movie)
      setDetailOpen(true)
      if (playingRef.current) void api.hideVideo()

      const token = ++detailToken.current
      setLoadingText('Identifying movie & searching databases…')
      setLoading(true)
      setMeta(null)
      setSubtitles([])
      setPlayStatus('')
      setPlayStatusError(false)

      const [subs, m] = await Promise.all([api.getSubtitles(movie.path), api.getMetadata(movie.path)])
      if (token !== detailToken.current) return
      setSubtitles(!isError(subs) && Array.isArray(subs) ? subs : [])
      setMeta(isError(m) ? ({ error: m.error } as unknown as Metadata) : m)
      setLoading(false)
    },
    []
  )

  const rematch = useCallback(async () => {
    if (!selected) return
    const token = ++detailToken.current
    setLoadingText('Re-matching…')
    setLoading(true)
    const m = await api.refreshMetadata(selected.path)
    if (token !== detailToken.current) return
    setMeta(isError(m) ? ({ error: m.error } as unknown as Metadata) : m)
    setLoading(false)
  }, [selected])

  // ---- playback ------------------------------------------------------------
  const startPlayback = useCallback(
    async (path: string, subtitle: string, isTrailer: boolean) => {
      setNpTitle(meta?.title || selected?.title || 'Now playing')
      setFullscreen(false)
      setPlayStatus('')
      setPlayStatusError(false)
      setPlaying(true)
      playingRef.current = true

      await new Promise((r) => requestAnimationFrame(r))
      await syncRegion()

      const result = isTrailer ? await api.playTrailer(path) : await api.play(path, subtitle)
      if (isError(result) || !result.player) {
        setPlaying(false)
        void api.hideVideo()
        setPlayStatus(isError(result) ? result.error : 'Playback failed.')
        setPlayStatusError(true)
        return // keep the detail open so the error is visible
      }
      if (result.embedded === false) {
        setPlaying(false)
        setPlayStatus(`Opened in ${result.player}.`)
        setPlayStatusError(false)
        return
      }
      closeDetail() // success: reveal the split + video surface
      await syncRegion()
    },
    [meta, selected, syncRegion, closeDetail]
  )

  const toggleFullscreen = useCallback(async () => {
    if (!playingRef.current) return
    const next = !fullscreenRef.current
    setFullscreen(next)
    fullscreenRef.current = next
    await api.setFullscreen(next)
    setTimeout(() => void syncRegion(), 250)
  }, [syncRegion])

  const exitPlayer = useCallback(async () => {
    if (fullscreenRef.current) await toggleFullscreen()
    setPlaying(false)
    playingRef.current = false
    await api.stopPlayback()
  }, [toggleFullscreen])

  // ---- listeners (mount-only; call through refs) ---------------------------
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const actions = useRef({ closeDetail, toggleFullscreen, exitPlayer, syncRegion, closeSettings })
  actions.current = { closeDetail, toggleFullscreen, exitPlayer, syncRegion, closeSettings }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (detailOpenRef.current) actions.current.closeDetail()
        else if (settingsOpenRef.current) actions.current.closeSettings()
        else if (fullscreenRef.current) void actions.current.toggleFullscreen()
        else if (playingRef.current) void actions.current.exitPlayer()
        return
      }
      if (!playingRef.current || detailOpenRef.current) return
      const tag = (document.activeElement && document.activeElement.tagName) || ''
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'f') {
        e.preventDefault()
        void actions.current.toggleFullscreen()
        return
      }
      const name = KEY_MAP[e.key]
      if (!name) return
      e.preventDefault()
      void api.playerKey(name)
    }

    const onResize = (): void => {
      if (playingRef.current) void actions.current.syncRegion()
    }

    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(() => {
      if (playingRef.current) void actions.current.syncRegion()
    })
    if (videoRegionRef.current) ro.observe(videoRegionRef.current)
    const off = window.events?.onPlaybackEnded(() => {
      if (playingRef.current) void actions.current.exitPlayer()
    })
    // The controls overlay drives fullscreen/exit through App's existing handlers so region sync
    // and pane state stay consistent (the overlay never touches App layout directly).
    const offFs = window.events?.onRequestFullscreenToggle(() => {
      if (playingRef.current) void actions.current.toggleFullscreen()
    })
    const offExit = window.events?.onRequestExit(() => {
      if (playingRef.current) void actions.current.exitPlayer()
    })

    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      off?.()
      offFs?.()
      offExit?.()
    }
  }, [])

  // ---- folder actions ------------------------------------------------------
  const switchFolder = useCallback(
    async (folder: string) => {
      closeDetail()
      const data = await api.setFolder(folder)
      if (!isError(data)) void loadMovies(data)
    },
    [closeDetail, loadMovies]
  )

  const addFolder = useCallback(async () => {
    const data = await api.chooseFolder()
    if ((data as ChooseFolderCancelled).cancelled) return
    if (isError(data)) {
      console.error(data.error)
      return
    }
    closeDetail()
    void loadMovies(data as MoviesPayload)
  }, [closeDetail, loadMovies])

  const removeFolder = useCallback(
    async (folder: string) => {
      const data = await api.removeFolder(folder)
      if (isError(data)) {
        console.error(data.error)
        return
      }
      closeDetail()
      void loadMovies(data)
    },
    [closeDetail, loadMovies]
  )

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">MovieShelf</span>
        </div>
        <div className="search">
          <SearchIcon />
          <input
            id="search"
            type="search"
            placeholder="Search titles…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="layout">
        <Sidebar
          folders={folders}
          current={current}
          count={movies.length}
          onSwitch={(f) => void switchFolder(f)}
          onRemove={(f) => void removeFolder(f)}
          onRefresh={() => void loadMovies()}
          onAddFolder={() => void addFolder()}
          onOpenSettings={() => setSettingsOpen(true)}
          progress={progress}
        />
        <main className={'content' + (fullscreen ? ' fullscreen' : '')}>
          <PlayerPane
            ref={videoRegionRef}
            visible={playing}
            title={npTitle}
            fullscreen={fullscreen}
            onFullscreenToggle={() => void toggleFullscreen()}
            onClose={() => void exitPlayer()}
          />
          {settingsOpen ? (
            <SettingsPage onClose={closeSettings} onCacheCleared={() => void loadMovies()} />
          ) : (
            <Grid
              movies={movies}
              filtered={filtered}
              query={query.trim()}
              covers={covers}
              ratings={ratings}
              selectedPath={selected?.path ?? null}
              scanning={scanning}
              onSelect={(m) => void selectMovie(m)}
            />
          )}
        </main>
      </div>

      <DetailModal
        open={detailOpen}
        movie={selected}
        meta={meta}
        subtitles={subtitles}
        loading={loading}
        loadingText={loadingText}
        playStatus={playStatus}
        playStatusError={playStatusError}
        onClose={closeDetail}
        onPlay={(sub) => selected && void startPlayback(selected.path, sub, false)}
        onStop={() => void exitPlayer()}
        onTrailer={() => meta?.trailer && void startPlayback(meta.trailer.path, '', true)}
        onRematch={() => void rematch()}
      />

      <UpdateBanner />
    </>
  )
}
