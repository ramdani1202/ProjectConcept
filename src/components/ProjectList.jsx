export default function ProjectList({ projects, onOpen, onCreate, onDelete }) {
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  const handleDelete = (e, p) => {
    e.stopPropagation();
    if (confirm(`Hapus project "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
      onDelete(p.id);
    }
  };

  return (
    <div id="screen-list" className="screen active">
      <div className="list-header">
        <h1>Project Concept</h1>
        <span className="count">{projects.length} project</span>
      </div>

      <div id="project-grid">
        {sorted.length === 0 && (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="#948B7C" strokeWidth="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="#948B7C" strokeWidth="1.5" />
              <path d="M10 6.5H14M6.5 10V14" stroke="#948B7C" strokeWidth="1.5" />
            </svg>
            <p>Belum ada project. Ketuk tombol + untuk mulai memetakan konsep pertamamu.</p>
          </div>
        )}

        {sorted.map((p) => {
          const dateStr = new Date(p.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          return (
            <div className="project-card" key={p.id} onClick={() => onOpen(p.id)}>
              <button className="delete-btn" onClick={(e) => handleDelete(e, p)} aria-label="Hapus">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <h3>{p.name}</h3>
              <div className="meta">
                <span>{(p.nodes || []).length} node</span><span>·</span><span>{dateStr}</span>
              </div>
            </div>
          );
        })}
      </div>

      <button className="fab" onClick={onCreate} aria-label="Project baru">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 5V19M5 12H19" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
