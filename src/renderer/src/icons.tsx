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

export function Skip10Back(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 6 A6 6 0 1 1 5.5 9.5" strokeLinecap="round" />
      <path d="M8 4 L5 6.5 L8 9" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="16" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">
        10
      </text>
    </svg>
  )
}

export function Skip10Fwd(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 6 A6 6 0 1 0 18.5 9.5" strokeLinecap="round" />
      <path d="M16 4 L19 6.5 L16 9" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="16" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">
        10
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
