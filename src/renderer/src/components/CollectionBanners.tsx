import type { CollectionGroup } from '@shared/types'

interface Props {
  collections: CollectionGroup[]
  onOpen: (group: CollectionGroup) => void
}

// Horizontal strip of themed, clickable franchise banners shown atop the browse grid.
// Each banner is a colored gradient (the collection's theme) with its title + owned-movie count.
export function CollectionBanners({ collections, onOpen }: Props): React.JSX.Element | null {
  if (!collections.length) return null
  return (
    <section className="collection-banners" aria-label="Collections">
      {collections.map((c) => (
        <button
          key={c.key}
          className="collection-banner"
          style={{ backgroundImage: `linear-gradient(135deg, ${c.colors[0]} 0%, ${c.colors[1]} 100%)` }}
          onClick={() => onOpen(c)}
          title={`${c.title} — ${c.movies.length} movies`}
        >
          <span className="cb-title">{c.title}</span>
          <span className="cb-count">{c.movies.length} movies</span>
        </button>
      ))}
    </section>
  )
}
