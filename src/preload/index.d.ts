import type {
  MovieShelfApi,
  UpdateAvailablePayload,
  UpdateProgressPayload,
  UpdateDownloadedPayload,
  UpdateErrorPayload
} from '../../shared/types'

export interface MovieShelfEvents {
  onPlaybackEnded(cb: () => void): () => void
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
