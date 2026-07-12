import type {
  MovieShelfApi,
  PlaybackStatus,
  RatingResolved,
  RatingsProgress,
  UpdateAvailablePayload,
  UpdateProgressPayload,
  UpdateDownloadedPayload,
  UpdateErrorPayload
} from '../../shared/types'

export interface MovieShelfEvents {
  onPlaybackEnded(cb: () => void): () => void
  onPlaybackStatus(cb: (p: Partial<PlaybackStatus>) => void): () => void
  onControlsActive(cb: (active: boolean) => void): () => void
  onSettingsChanged(cb: () => void): () => void
  onRatingResolved(cb: (p: RatingResolved) => void): () => void
  onRatingsProgress(cb: (p: RatingsProgress) => void): () => void
  onRequestFullscreenToggle(cb: () => void): () => void
  onRequestExit(cb: () => void): () => void
  onUpdateAvailable(cb: (p: UpdateAvailablePayload) => void): () => void
  onUpdateProgress(cb: (p: UpdateProgressPayload) => void): () => void
  onUpdateDownloaded(cb: (p: UpdateDownloadedPayload) => void): () => void
  onUpdateError(cb: (p: UpdateErrorPayload) => void): () => void
}

declare global {
  interface Window {
    api: MovieShelfApi
    events: MovieShelfEvents
  }
}

export {}
