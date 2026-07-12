interface Props {
  folders: string[]
  current: string
  count: number
  onSwitch: (folder: string) => void
  onRemove: (folder: string) => void
}

export function Sidebar({ folders, current, count, onSwitch, onRemove }: Props): React.JSX.Element {
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
        <div className="card-label">Saved libraries</div>
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
    </aside>
  )
}
