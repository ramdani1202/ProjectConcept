export default function NodeItem({
  node, selected, registerEl,
  onPointerDownBody, onSelect, onDelete, onTextChange, onStartConnection
}) {
  const handleBodyPointerDown = (e) => {
    if (e.target.closest('.port') || e.target.closest('.node-text')) return;
    onSelect();
    e.stopPropagation();
    onPointerDownBody(e);
  };

  return (
    <div
      className={`node${selected ? ' selected' : ''}`}
      style={{ left: node.x, top: node.y }}
      data-id={node.id}
      ref={registerEl}
      onPointerDown={handleBodyPointerDown}
    >
      <div className="node-body">
        {(node.type === 'image' || node.type === 'mixed') && (
          node.image ? (
            <div className="node-img-wrap">
              <img src={node.image} draggable="false" alt="" />
            </div>
          ) : (
            <div className="node-img-wrap placeholder-wrap">
              <svg className="placeholder" width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21 15L16 10L5 19" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          )
        )}
        <div
          className="node-text"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Tulis catatan…"
          onPointerDown={(e) => e.stopPropagation()}
          onInput={(e) => onTextChange(e.target.textContent)}
        >
          {node.text}
        </div>
      </div>

      <div className="port port-in" data-role="in" onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }} />
      <div
        className="port port-out"
        data-role="out"
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartConnection(e); }}
      />
      <div className="node-delete" onPointerDown={(e) => { e.stopPropagation(); onDelete(); }}>×</div>
    </div>
  );
}
