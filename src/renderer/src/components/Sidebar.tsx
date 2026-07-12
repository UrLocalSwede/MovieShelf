import { RefreshIcon, AddFolderIcon, SettingsIcon } from '../icons'

interface Props {
  folders: string[]
  current: string
  count: number
  onSwitch: (folder: string) => void
  onRemove: (folder: string) => void
  onRefresh: () => void
  onAddFolder: () => void
  onOpenSettings: () => void
}

export function Sidebar({
  folders,
  current,
  count,
  onSwitch,
  onRemove,
  onRefresh,
  onAddFolder,
  onOpenSettings
}: Props): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="card">
        <div className="card-label">Current folder</div>
        <div className="folder-path">{current || '—'}</div>
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
