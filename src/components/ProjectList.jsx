export default function ProjectList({ projects, onOpen, onCreate, onDelete, onRename }) {
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  const handleDelete = (e, p) => {
    e.stopPropagation();
    if (confirm(`Hapus project "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
      onDelete(p.id);
    }
  };

  const handleRename = (e, p) => {
    e.stopPropagation();
    const next = prompt('Nama project baru:', p.name);
    if (next && next.trim() && next.trim() !== p.name) {
      onRename(p.id, next.trim());
    }
  };

  return (
    <div id="screen-list" className="screen active">
      <div className="list-header">
        <h1>Project Concept</h1>
        <span className="count">{projects.length} project</span>
      </div>

      <button className="new-project-btn" onClick={onCreate}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 5V19M5 12H19" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <span>Project baru</span>
      </button>

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
              <div className="card-actions">
                <button className="icon-mini" onClick={(e) => handleRename(e, p)} aria-label="Ubah nama">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M4 20L4.6 16.9C4.7 16.4 4.95 15.95 5.3 15.6L15.6 5.3C16.4 4.5 17.7 4.5 18.5 5.3L18.7 5.5C19.5 6.3 19.5 7.6 18.7 8.4L8.4 18.7C8.05 19.05 7.6 19.3 7.1 19.4L4 20Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </button>
                <button className="icon-mini danger" onClick={(e) => handleDelete(e, p)} aria-label="Hapus">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <h3>{p.name}</h3>
              <div className="meta">
                <span>{(p.nodes || []).length} node</span><span>·</span><span>{dateStr}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="app-watermark">Human's Daya Crop</div>
    </div>
  );
}
