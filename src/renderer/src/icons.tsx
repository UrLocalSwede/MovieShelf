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
