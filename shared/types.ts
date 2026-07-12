// Shared IPC payload types — kept identical in shape to the legacy Python bridge (api.py)
// so the renderer logic maps 1:1. Every bridge call may instead resolve to { error }.

export interface ApiError {
  error: string
}

export type Result<T> = T | ApiError

export function isError(v: unknown): v is ApiError {
  return typeof v === 'object' && v !== null && 'error' in v
}

export interface Movie {
  title: string
  path: string
}

export interface MoviesPayload {
  folder: string
  count: number
  movies: Movie[]
  folders: string[]
}

export interface ListState {
  folders: string[]
  current: string
}

export interface ChooseFolderCancelled {
  cancelled: true
}

export interface Parsed {
  title: string
  year: number | null
  edition: string
  source: string
  screen_size: string
  country: string
  language: string
}

export interface Fingerprint {
  duration_min?: number | null
  width?: number | null
  height?: number | null
  resolution?: string
  container?: string
  embedded_title?: string
}

export interface CollectionPart {
  title: string
  year: number | null
  poster_file?: string
  poster?: string
}

export interface Collection {
  name: string
  parts: CollectionPart[]
}

export interface Trailer {
  path: string
  name: string
}

export interface Ratings {
  imdb?: string
  rotten_tomatoes?: string
  metacritic?: string
  tmdb?: string
}

export interface Metadata {
  matched: boolean
  confidence: number
  title: string
  year: number | null
  tagline?: string
  overview?: string
  genres?: string[]
  runtime?: number | null
  countries?: string[]
  ratings?: Ratings
  ids?: { tmdb?: number | null; imdb?: string }
  parsed?: Parsed
  fingerprint?: Fingerprint
  poster_file?: string
  backdrop_file?: string
  poster?: string
  backdrop?: string
  collection?: Collection | null
  trailer?: Trailer | null
  // Present when no TMDb key is configured:
  needs_key?: boolean
  message?: string
  // Present when a bridge call failed (surfaced in the detail view).
  error?: string
}

export interface CoverResult {
  poster?: string
}

export interface SubtitleEntry {
  name: string
  path: string
}

export type PlayerBackend = 'mpv' | 'VLC' | 'default player'

export interface PlayResult {
  player: PlayerBackend
  embedded: boolean
}

// The full renderer-facing API surface (mirrors api.py's Api class).
export interface MovieShelfApi {
  listState(): Promise<Result<ListState>>
  listMovies(): Promise<Result<MoviesPayload>>
  setFolder(path: string): Promise<Result<MoviesPayload>>
  removeFolder(path: string): Promise<Result<MoviesPayload>>
  chooseFolder(): Promise<Result<MoviesPayload | ChooseFolderCancelled>>
  getCover(path: string): Promise<Result<CoverResult>>
  getMetadata(path: string): Promise<Result<Metadata>>
  refreshMetadata(path: string): Promise<Result<Metadata>>
  getSubtitles(path: string): Promise<Result<SubtitleEntry[]>>
  play(path: string, subtitlePath?: string): Promise<Result<PlayResult>>
  playTrailer(trailerPath: string): Promise<Result<PlayResult>>
  stopPlayback(): Promise<Result<{ stopped: true }>>
  playerKey(name: string): Promise<Result<{ ok: true }>>
  showVideo(): Promise<Result<{ ok: true }>>
  hideVideo(): Promise<Result<{ ok: true }>>
  setPlayerRegion(x: number, y: number, w: number, h: number): Promise<Result<{ ok: true }>>
  setFullscreen(on: boolean): Promise<Result<{ fullscreen: boolean }>>
  checkForUpdates(): Promise<Result<{ checking: boolean }>>
  quitAndInstall(): Promise<Result<{ ok: true }>>
}

// Update event payloads (main → renderer).
export interface UpdateAvailablePayload {
  version: string
}
export interface UpdateProgressPayload {
  percent: number
}
export interface UpdateDownloadedPayload {
  version: string
}
export interface UpdateErrorPayload {
  message: string
}

// IPC channel names — single source of truth for main + preload.
export const IPC = {
  listState: 'list-state',
  listMovies: 'list-movies',
  setFolder: 'set-folder',
  removeFolder: 'remove-folder',
  chooseFolder: 'choose-folder',
  getCover: 'get-cover',
  getMetadata: 'get-metadata',
  refreshMetadata: 'refresh-metadata',
  getSubtitles: 'get-subtitles',
  play: 'play',
  playTrailer: 'play-trailer',
  stopPlayback: 'stop-playback',
  playerKey: 'player-key',
  showVideo: 'show-video',
  hideVideo: 'hide-video',
  setPlayerRegion: 'set-player-region',
  setFullscreen: 'set-fullscreen',
  updateCheck: 'update-check',
  updateInstall: 'update-install'
} as const

// Main → renderer events.
export const EVT = {
  playbackEnded: 'playback-ended',
  updateAvailable: 'update-available',
  updateProgress: 'update-progress',
  updateDownloaded: 'update-downloaded',
  updateError: 'update-error'
} as const
