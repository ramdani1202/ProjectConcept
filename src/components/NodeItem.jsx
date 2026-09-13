import { useRef, useEffect } from 'react';

export default function NodeItem({
  node, selected, registerEl,
  onPointerDownBody, onSelect, onDelete, onTextChange, onStartConnection
}) {
  const textRef = useRef(null);
  const lastTapRef = useRef(0);
  const editingRef = useRef(false);

  // Sync node.text into the DOM only when it changes from OUTSIDE
  // (e.g. undo). While the user is actively typing, never overwrite
  // the live DOM content — that's what caused the reversed-text bug.
  useEffect(() => {
    if (editingRef.current) return;
    if (textRef.current && textRef.current.textContent !== (node.text || '')) {
      textRef.current.textContent = node.text || '';
    }
  }, [node.text]);

  const handleBodyPointerDown = (e) => {
    if (e.target.closest('.port')) return;
    const onText = e.target.closest('.node-text');
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 350;
    lastTapRef.current = now;

    onSelect();

    if (onText && isDoubleTap) {
      // Deliberate double-tap on the text: let it focus for editing,
      // don't start a drag.
      editingRef.current = true;
      return;
    }

    // Any other tap (single tap anywhere, including over the text)
    // starts a drag instead of placing a caret.
    e.stopPropagation();
    e.preventDefault();
    onPointerDownBody(e);
  };

  const handleTextBlur = () => {
    editingRef.current = false;
  };

  const handleTextInput = (e) => {
    onTextChange(e.target.textContent);
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
          ref={textRef}
          data-placeholder="Ketuk 2x untuk tulis catatan…"
          onInput={handleTextInput}
          onBlur={handleTextBlur}
        />
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
