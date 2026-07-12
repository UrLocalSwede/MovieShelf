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

// Average rating (0–10, or null when unrated/unmatched) plus release year for a movie, derived from
// its cached Metadata. Surfaced to the grid for the poster badge and for sorting.
export interface RatingInfo {
  rating: number | null
  year: number | null
}

// A single movie's rating resolving during the background prefetch sweep (main → renderer).
export interface RatingResolved extends RatingInfo {
  path: string
}

// Progress of the background rating prefetch (main → renderer).
export interface RatingsProgress {
  done: number
  total: number
  running: boolean
}

// Editable API keys (as stored, no env/sample-key fallbacks) surfaced in the settings page.
export interface ApiKeysPayload {
  tmdb: string
  omdb: string
}

// General app settings persisted to settings.json.
export interface AppSettings {
  autoDownloadUpdates: boolean
  defaultVolume: number // 0–100, applied when playback starts
  skipSeconds: number // amount the ±skip buttons jump
  prefetchRatings: boolean // pre-fetch/cache all ratings in the background; off = cache on view
}

export interface SubtitleEntry {
  name: string
  path: string
  // Present when detected from the filename (additive; older callers ignore these):
  language?: string // display name, e.g. "English", "Swedish", or "Unknown"
  label?: string // UI label, e.g. "English (forced)" — falls back to name when absent
  forced?: boolean
}

export type PlayerBackend = 'mpv' | 'VLC' | 'default player'

export interface PlayResult {
  player: PlayerBackend
  embedded: boolean
}

// Live playback telemetry pushed from mpv (main) to the controls overlay renderer.
// Fields arrive incrementally as mpv property observers fire, so the renderer merges
// each patch into its running state.
export interface PlaybackStatus {
  timePos: number // seconds, current position
  duration: number // seconds, 0 until known
  pause: boolean
  volume: number // mpv scale (~0–130)
  mute: boolean
  subVisible: boolean
}

// The full renderer-facing API surface (mirrors api.py's Api class).
export interface MovieShelfApi {
  listState(): Promise<Result<ListState>>
  listMovies(): Promise<Result<MoviesPayload>>
  setFolder(path: string): Promise<Result<MoviesPayload>>
  removeFolder(path: string): Promise<Result<MoviesPayload>>
  chooseFolder(): Promise<Result<MoviesPayload | ChooseFolderCancelled>>
  getCover(path: string): Promise<Result<CoverResult>>
  getRatings(paths: string[]): Promise<Result<Record<string, RatingInfo>>>
  getMetadata(path: string): Promise<Result<Metadata>>
  refreshMetadata(path: string): Promise<Result<Metadata>>
  getSubtitles(path: string): Promise<Result<SubtitleEntry[]>>
  getApiKeys(): Promise<Result<ApiKeysPayload>>
  saveApiKeys(keys: ApiKeysPayload): Promise<Result<{ ok: true }>>
  getSettings(): Promise<Result<AppSettings>>
  saveSettings(settings: AppSettings): Promise<Result<AppSettings>>
  clearCache(): Promise<Result<{ ok: true }>>
  play(path: string, subtitlePath?: string): Promise<Result<PlayResult>>
  playTrailer(trailerPath: string): Promise<Result<PlayResult>>
  stopPlayback(): Promise<Result<{ stopped: true }>>
  playerKey(name: string): Promise<Result<{ ok: true }>>
  playerSeek(seconds: number): Promise<Result<{ ok: true }>> // absolute position
  playerSkip(delta: number): Promise<Result<{ ok: true }>> // relative ±seconds
  playerSetPause(paused: boolean): Promise<Result<{ ok: true }>>
  playerSetVolume(volume: number): Promise<Result<{ ok: true }>>
  playerSetMute(muted: boolean): Promise<Result<{ ok: true }>>
  playerToggleSub(visible: boolean): Promise<Result<{ ok: true }>>
  controlsFullscreenToggle(): Promise<Result<{ ok: true }>> // overlay → main → App
  controlsExit(): Promise<Result<{ ok: true }>> // overlay → main → App
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
  getRatings: 'get-ratings',
  getMetadata: 'get-metadata',
  refreshMetadata: 'refresh-metadata',
  getSubtitles: 'get-subtitles',
  getApiKeys: 'get-api-keys',
  saveApiKeys: 'save-api-keys',
  getSettings: 'get-settings',
  saveSettings: 'save-settings',
  clearCache: 'clear-cache',
  play: 'play',
  playTrailer: 'play-trailer',
  stopPlayback: 'stop-playback',
  playerKey: 'player-key',
  playerSeek: 'player-seek',
  playerSkip: 'player-skip',
  playerSetPause: 'player-set-pause',
  playerSetVolume: 'player-set-volume',
  playerSetMute: 'player-set-mute',
  playerToggleSub: 'player-toggle-sub',
  controlsFullscreenToggle: 'controls-fullscreen-toggle',
  controlsExit: 'controls-exit',
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
  playbackStatus: 'playback-status', // main → controls overlay (PlaybackStatus patch)
  controlsActive: 'controls-active', // main → controls overlay (boolean: reveal/hide)
  settingsChanged: 'settings-changed', // main → all windows (settings saved; re-read as needed)
  ratingResolved: 'rating-resolved', // main → all windows (one movie's rating prefetched)
  ratingsProgress: 'ratings-progress', // main → all windows (prefetch sweep progress)
  requestFullscreenToggle: 'request-fullscreen-toggle', // main → main renderer (App)
  requestExit: 'request-exit', // main → main renderer (App)
  updateAvailable: 'update-available',
  updateProgress: 'update-progress',
  updateDownloaded: 'update-downloaded',
  updateError: 'update-error'
} as const
