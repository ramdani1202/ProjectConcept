import { useRef, useState, useCallback, useEffect } from 'react';
import { uid, compressImageToDataUrl, bezierPath } from '../utils.js';
import NodeItem from './NodeItem.jsx';
import { exportProjectToPdf } from '../exportPdf.js';

const HISTORY_LIMIT = 30;

export default function CanvasScreen({ project, onBack, onUpdate, onPersist, onToast }) {
  const [title, setTitle] = useState(project.name);
  const [nodes, setNodes] = useState(project.nodes);
  const [connections, setConnections] = useState(project.connections);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('Tersimpan');
  const [connectingFrom, setConnectingFrom] = useState(null); // nodeId
  const [tempLine, setTempLine] = useState(null); // {x1,y1,x2,y2}

  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const fileInputRef = useRef(null);
  const nodeElRefs = useRef({}); // id -> DOM el, for measuring size

  const historyRef = useRef([]);
  const [, forceRender] = useState(0);
  const saveTimerRef = useRef(null);

  const draggingRef = useRef(null); // {id, offsetX, offsetY}
  const panStateRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const connectingPointerIdRef = useRef(null);
  const tempAnimRef = useRef({ raf: null, current: null, target: null, from: null });

  // ---------------- persistence ----------------
  const scheduleSave = useCallback((nextNodes, nextConnections, nextTitle) => {
    setSaveStatus('Menyimpan…');
    onUpdate((p) => ({
      ...p,
      name: nextTitle !== undefined ? nextTitle : p.name,
      nodes: nextNodes !== undefined ? nextNodes : p.nodes,
      connections: nextConnections !== undefined ? nextConnections : p.connections
    }));
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await onPersist({
        ...project,
        name: nextTitle !== undefined ? nextTitle : title,
        nodes: nextNodes !== undefined ? nextNodes : nodes,
        connections: nextConnections !== undefined ? nextConnections : connections
      });
      setSaveStatus('Tersimpan');
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, connections, title, project, onUpdate, onPersist]);

  const manualSave = async () => {
    await onPersist({ ...project, name: title, nodes, connections });
    setSaveStatus('Tersimpan');
    onToast('Project disimpan');
  };

  // ---------------- undo history ----------------
  const pushHistory = useCallback(() => {
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections))
    });
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    forceRender((n) => n + 1);
  }, [nodes, connections]);

  const undo = () => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    setNodes(snap.nodes);
    setConnections(snap.connections);
    scheduleSave(snap.nodes, snap.connections);
    forceRender((n) => n + 1);
    onToast('Dikembalikan');
  };

  // ---------------- title ----------------
  const handleTitleChange = (e) => {
    const v = e.target.value || 'Tanpa nama';
    setTitle(v);
    scheduleSave(undefined, undefined, v);
  };

  // ---------------- zoom / pan ----------------
  const applyZoom = (delta) => setScale((s) => Math.min(2.2, Math.max(0.35, s + delta)));
  const resetZoom = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  const onViewportPointerDown = (e) => {
    if (e.target.closest('.node') || e.target.closest('.port')) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      panStateRef.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchRef.current = {
        startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        startScale: scale
      };
      panStateRef.current = null;
    }
    setSelectedId(null);
  };

  const onViewportPointerMove = (e) => {
    // connection drag
    if (connectingFrom && e.pointerId === connectingPointerIdRef.current) {
      const rect = worldRef.current.getBoundingClientRect();
      tempAnimRef.current.target = {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale
      };
      return;
    }
    // node drag
    if (draggingRef.current) {
      const rect = worldRef.current.getBoundingClientRect();
      const { id, offsetX, offsetY } = draggingRef.current;
      const x = (e.clientX - rect.left) / scale - offsetX;
      const y = (e.clientY - rect.top) / scale - offsetY;
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
      return;
    }

    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setScale(Math.min(2.2, Math.max(0.35, pinchRef.current.startScale * (dist / pinchRef.current.startDist))));
      return;
    }

    if (panStateRef.current && pointersRef.current.size === 1) {
      const dx = e.clientX - panStateRef.current.startX;
      const dy = e.clientY - panStateRef.current.startY;
      setPan({ x: panStateRef.current.origX + dx, y: panStateRef.current.origY + dy });
    }
  };

  const endPointer = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    panStateRef.current = null;

    if (draggingRef.current) {
      draggingRef.current = null;
      scheduleSave(undefined, undefined);
      // nodes state already updated live; persist current
      setNodes((cur) => { scheduleSave(cur, connections); return cur; });
    }

    if (connectingFrom && e.pointerId === connectingPointerIdRef.current) {
      const targetEl = document.elementFromPoint(e.clientX, e.clientY);
      const targetNodeEl = targetEl ? targetEl.closest('.node') : null;
      if (targetNodeEl) {
        const toId = targetNodeEl.dataset.id;
        if (toId && toId !== connectingFrom) {
          completeConnection(connectingFrom, toId);
        }
      }
      cancelConnection();
    }
  };

  // ---------------- nodes ----------------
  const addNode = (type) => {
    pushHistory();
    const vw = viewportRef.current.clientWidth, vh = viewportRef.current.clientHeight;
    const centerX = (vw / 2 - pan.x) / scale - 90;
    const centerY = (vh / 2 - pan.y) / scale - 40;
    const node = {
      id: uid(), type, text: '', image: null,
      x: centerX + (Math.random() * 40 - 20),
      y: centerY + (Math.random() * 40 - 20)
    };
    const next = [...nodes, node];
    setNodes(next);
    scheduleSave(next, connections);
  };

  const handleImagePick = () => fileInputRef.current.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await compressImageToDataUrl(file, 720, 0.72);
    pushHistory();
    const vw = viewportRef.current.clientWidth, vh = viewportRef.current.clientHeight;
    const centerX = (vw / 2 - pan.x) / scale - 90;
    const centerY = (vh / 2 - pan.y) / scale - 60;
    const node = {
      id: uid(), type: 'image', text: '', image: dataUrl,
      x: centerX + (Math.random() * 40 - 20),
      y: centerY + (Math.random() * 40 - 20)
    };
    const next = [...nodes, node];
    setNodes(next);
    scheduleSave(next, connections);
  };

  const deleteNode = (id) => {
    pushHistory();
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextConns = connections.filter((c) => c.from !== id && c.to !== id);
    setNodes(nextNodes);
    setConnections(nextConns);
    scheduleSave(nextNodes, nextConns);
  };

  const updateNodeText = (id, text) => {
    const next = nodes.map((n) => (n.id === id ? { ...n, text } : n));
    setNodes(next);
    scheduleSave(next, connections);
  };

  const startNodeDrag = (id, e) => {
    pushHistory();
    setSelectedId(id);
    try { viewportRef.current.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    const rect = worldRef.current.getBoundingClientRect();
    const node = nodes.find((n) => n.id === id);
    draggingRef.current = {
      id,
      offsetX: (e.clientX - rect.left) / scale - node.x,
      offsetY: (e.clientY - rect.top) / scale - node.y
    };
  };

  // ---------------- connections ----------------
  const startConnection = (nodeId, e) => {
    setConnectingFrom(nodeId);
    try { viewportRef.current.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    connectingPointerIdRef.current = e.pointerId;

    const fromEl = nodeElRefs.current[nodeId];
    const fromPos = getPortPos(nodeId, 'out');
    tempAnimRef.current.from = fromPos;
    tempAnimRef.current.current = { ...fromPos };
    tempAnimRef.current.target = { ...fromPos };

    const tick = () => {
      if (!tempAnimRef.current.from) { tempAnimRef.current.raf = null; return; }
      const cur = tempAnimRef.current.current;
      const tgt = tempAnimRef.current.target;
      cur.x += (tgt.x - cur.x) * 0.45;
      cur.y += (tgt.y - cur.y) * 0.45;
      setTempLine({ x1: tempAnimRef.current.from.x, y1: tempAnimRef.current.from.y, x2: cur.x, y2: cur.y });
      tempAnimRef.current.raf = requestAnimationFrame(tick);
    };
    tempAnimRef.current.raf = requestAnimationFrame(tick);
  };

  const cancelConnection = () => {
    setConnectingFrom(null);
    setTempLine(null);
    if (tempAnimRef.current.raf) cancelAnimationFrame(tempAnimRef.current.raf);
    tempAnimRef.current = { raf: null, current: null, target: null, from: null };
    connectingPointerIdRef.current = null;
  };

  const completeConnection = (fromId, toId) => {
    if (fromId === toId) { cancelConnection(); return; }
    if (connections.some((c) => c.from === fromId && c.to === toId)) { cancelConnection(); return; }
    pushHistory();
    const next = [...connections, { id: uid(), from: fromId, to: toId }];
    setConnections(next);
    scheduleSave(nodes, next);
  };

  const deleteConnection = (connId) => {
    if (!confirm('Hapus koneksi ini?')) return;
    pushHistory();
    const next = connections.filter((c) => c.id !== connId);
    setConnections(next);
    scheduleSave(nodes, next);
  };

  function getPortPos(nodeId, role) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const el = nodeElRefs.current[nodeId];
    const w = el ? el.offsetWidth : 160;
    const h = el ? el.offsetHeight : 60;
    return role === 'out' ? { x: node.x + w, y: node.y + h / 2 } : { x: node.x, y: node.y + h / 2 };
  }

  // ---------------- export ----------------
  const handleExportPdf = async () => {
    if (nodes.length === 0) { onToast('Canvas masih kosong'); return; }
    onToast('Menyiapkan PDF…');
    await exportProjectToPdf({ name: title, nodes, connections }, nodeElRefs.current);
    onToast('PDF diunduh');
  };

  return (
    <div id="screen-canvas" className="screen active">
      <div className="canvas-topbar">
        <button className="icon-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="icon-btn" onClick={undo} disabled={historyRef.current.length === 0} style={{ opacity: historyRef.current.length === 0 ? 0.4 : 1 }} title="Urungkan">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M9 14L4 9L9 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 9H15C18 9 20 11 20 14C20 17 18 19 15 19H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <input id="project-title-input" value={title} onChange={handleTitleChange} />
        <div className="save-indicator" onClick={manualSave} style={{ cursor: 'pointer' }}>
          <span className="dot"></span><span>{saveStatus}</span>
        </div>
      </div>

      <div
        className="canvas-viewport"
        ref={viewportRef}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div id="canvas-world" ref={worldRef} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
          <svg id="svg-layer">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L0,6 L7,3 Z" fill="#D97757" />
              </marker>
            </defs>
            {connections.map((c) => {
              const from = getPortPos(c.from, 'out');
              const to = getPortPos(c.to, 'in');
              const d = bezierPath(from.x, from.y, to.x - 10, to.y);
              return (
                <g key={c.id}>
                  <path className="connection-hit" d={d} onPointerDown={(e) => { e.stopPropagation(); deleteConnection(c.id); }} />
                  <path className="connection-path" d={d} markerEnd="url(#arrowhead)" />
                </g>
              );
            })}
            {tempLine && (
              <path className="connection-path temp" d={bezierPath(tempLine.x1, tempLine.y1, tempLine.x2, tempLine.y2)} />
            )}
          </svg>

          <div id="nodes-layer">
            {nodes.map((node) => (
              <NodeItem
                key={node.id}
                node={node}
                selected={selectedId === node.id}
                registerEl={(el) => { nodeElRefs.current[node.id] = el; }}
                onPointerDownBody={(e) => startNodeDrag(node.id, e)}
                onSelect={() => setSelectedId(node.id)}
                onDelete={() => deleteNode(node.id)}
                onTextChange={(text) => updateNodeText(node.id, text)}
                onStartConnection={(e) => startConnection(node.id, e)}
              />
            ))}
          </div>
        </div>

        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => applyZoom(0.15)}>+</button>
          <button className="zoom-btn" style={{ fontSize: 11 }} onClick={resetZoom}>1:1</button>
          <button className="zoom-btn" onClick={() => applyZoom(-0.15)}>−</button>
        </div>
      </div>

      <div className="canvas-toolbar">
        <button className="toolbar-btn" onClick={() => addNode('text')}>+ Teks</button>
        <button className="toolbar-btn" onClick={handleImagePick}>+ Gambar</button>
        <button className="toolbar-btn primary" onClick={handleExportPdf}>Export PDF</button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}
