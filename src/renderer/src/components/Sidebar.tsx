import { RefreshIcon, AddFolderIcon, SettingsIcon, LibraryIcon, CollectionsIcon } from '../icons'
import { ALL_LIBRARIES } from '@shared/types'
import type { RatingsProgress } from '@shared/types'

interface Props {
  folders: string[]
  current: string
  count: number
  view: 'library' | 'collections'
  onSetView: (view: 'library' | 'collections') => void
  onSwitch: (folder: string) => void
  onRemove: (folder: string) => void
  onRefresh: () => void
  onAddFolder: () => void
  onOpenSettings: () => void
  progress: RatingsProgress
}

export function Sidebar({
  folders,
  current,
  count,
  view,
  onSetView,
  onSwitch,
  onRemove,
  onRefresh,
  onAddFolder,
  onOpenSettings,
  progress
}: Props): React.JSX.Element {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <button
          className={'nav-btn' + (view === 'library' ? ' active' : '')}
          onClick={() => onSetView('library')}
        >
          <LibraryIcon />
          <span>Library</span>
        </button>
        <button
          className={'nav-btn' + (view === 'collections' ? ' active' : '')}
          onClick={() => onSetView('collections')}
        >
          <CollectionsIcon />
          <span>Collections</span>
        </button>
      </nav>
      <div className="card">
        <div className="card-label">Current folder</div>
        <div className="folder-path">{current === ALL_LIBRARIES ? 'All libraries' : current || '—'}</div>
      </div>
      <div className="card stat">
        <div className="stat-num">{count}</div>
        <div className="stat-text">titles ready · built-in player</div>
      </div>
      <div className="card libraries">
        <div className="libraries-head">
          <div className="card-label">Saved libraries</div>
          <div className="libraries-actions">
            <button className="sidebar-icon-btn" title="Refresh library" onClick={onRefresh}>
              <RefreshIcon />
            </button>
            <button className="sidebar-icon-btn" title="Add folder" onClick={onAddFolder}>
              <AddFolderIcon />
            </button>
          </div>
        </div>
        <button
          className={'all-libraries' + (current === ALL_LIBRARIES ? ' active' : '')}
          title="Show movies from every saved library"
          onClick={() => onSwitch(ALL_LIBRARIES)}
        >
          <LibraryIcon />
          <span>All libraries</span>
        </button>
        <ul className="library-list">
          {folders.map((folder) => (
            <li key={folder} className={folder === current ? 'active' : ''} onClick={() => onSwitch(folder)}>
              <span className="lib-name">{folder}</span>
              <button
                className="lib-remove"
                title="Remove from list"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(folder)
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {progress.total > 0 && (
          <div className="library-progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="progress-label">
              {progress.running ? `Fetching ratings… ${progress.done}/${progress.total}` : 'Ratings ready'}
            </span>
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <button className="settings-btn" title="Settings" onClick={onOpenSettings}>
          <SettingsIcon />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
