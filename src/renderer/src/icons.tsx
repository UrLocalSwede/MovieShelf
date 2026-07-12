export function BrandMark(): React.JSX.Element {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <path className="brand-strip" d="M2 9 L22 9 M6 6 L4 9 M11 6 L9 9 M16 6 L14 9 M21 6 L19 9" />
      <path className="brand-play" d="M10 11.5 L15 14 L10 16.5 Z" />
    </svg>
  )
}

export function SearchIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21 L16 16" />
    </svg>
  )
}

export function FilmMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <path d="M10 11.5 L15 14 L10 16.5 Z" />
    </svg>
  )
}

// ---- Playback control icons (fill/stroke via currentColor so buttons theme them) ----

export function PlayIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M7 5 L19 12 L7 19 Z" />
    </svg>
  )
}

export function PauseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

export function Skip10Back({ seconds = 10 }: { seconds?: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 6 A6 6 0 1 1 5.5 9.5" strokeLinecap="round" />
      <path d="M8 4 L5 6.5 L8 9" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="16" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">
        {seconds}
      </text>
    </svg>
  )
}

export function Skip10Fwd({ seconds = 10 }: { seconds?: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 6 A6 6 0 1 0 18.5 9.5" strokeLinecap="round" />
      <path d="M16 4 L19 6.5 L16 9" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="16" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">
        {seconds}
      </text>
    </svg>
  )
}

export function VolumeIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9 H7 L11 5 V19 L7 15 H4 Z" fill="currentColor" stroke="none" />
      <path d="M15 9 A4 4 0 0 1 15 15" />
      <path d="M17.5 6.5 A7.5 7.5 0 0 1 17.5 17.5" />
    </svg>
  )
}

export function MuteIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9 H7 L11 5 V19 L7 15 H4 Z" fill="currentColor" stroke="none" />
      <path d="M15 9 L21 15 M21 9 L15 15" />
    </svg>
  )
}

export function SubtitlesIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M6 11 H10 M6 15 H14 M13 11 H18 M16 15 H18" />
    </svg>
  )
}

export function FullscreenIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" />
    </svg>
  )
}

export function FullscreenExitIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4 V9 H4 M20 9 H15 V4 M15 20 V15 H20 M4 15 H9 V20" />
    </svg>
  )
}

export function CloseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}

// ---- Sidebar toolbar / settings icons ----

export function RefreshIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11 A8 8 0 1 0 18 16" />
      <path d="M20 5 V11 H14" />
    </svg>
  )
}

export function AddFolderIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7 A2 2 0 0 1 5 5 H9 L11 7 H19 A2 2 0 0 1 21 9 V17 A2 2 0 0 1 19 19 H5 A2 2 0 0 1 3 17 Z" />
      <path d="M12 11 V16 M9.5 13.5 H14.5" />
    </svg>
  )
}

export function SettingsIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.485.485 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.487.487 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.485.485 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  )
}

export function ReverseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 V20 M7 4 L4 7 M7 4 L10 7" />
      <path d="M17 20 V4 M17 20 L14 17 M17 20 L20 17" />
    </svg>
  )
}

export function BackIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5 L8 12 L15 19" />
    </svg>
  )
}
