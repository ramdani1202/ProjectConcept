// app.js — logika utama Project Concept

const state = {
  projects: [],        // {id, name, updatedAt, nodes:[], connections:[]}
  currentProjectId: null,
  scale: 1,
  panX: 0,
  panY: 0,
  draggingNode: null,
  dragOffset: {x:0,y:0},
  connectingFrom: null, // {nodeId, x, y}
  panState: null,
  saveTimer: null,
};

const el = (id) => document.getElementById(id);
const screenList = el('screen-list');
const screenCanvas = el('screen-canvas');
const projectGrid = el('project-grid');
const projectCount = el('project-count');
const canvasViewport = el('canvas-viewport');
const canvasWorld = el('canvas-world');
const svgLayer = el('svg-layer');
const nodesLayer = document.createElement('div');
nodesLayer.id = 'nodes-layer';
el('canvas-world').appendChild(nodesLayer);
const titleInput = el('project-title-input');
const saveText = el('save-text');
const fileInput = el('file-input');
const toastEl = el('toast');

function uid(){ return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }

function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), 1800);
}

// ---------------- Init ----------------
async function init(){
  state.projects = await DB.getAll();
  renderProjectList();
}
init();

// ---------------- Project List ----------------
function renderProjectList(){
  projectGrid.innerHTML = '';
  projectCount.textContent = state.projects.length + (state.projects.length===1 ? ' project' : ' project');

  if(state.projects.length === 0){
    projectGrid.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#948B7C" stroke-width="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="#948B7C" stroke-width="1.5"/><path d="M10 6.5H14M6.5 10V14" stroke="#948B7C" stroke-width="1.5"/></svg>
        <p>Belum ada project. Ketuk tombol + untuk mulai memetakan konsep pertamamu.</p>
      </div>`;
    return;
  }

  const sorted = [...state.projects].sort((a,b)=>b.updatedAt - a.updatedAt);
  for(const p of sorted){
    const card = document.createElement('div');
    card.className = 'project-card';
    const date = new Date(p.updatedAt);
    const dateStr = date.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
    card.innerHTML = `
      <button class="delete-btn" data-id="${p.id}" aria-label="Hapus">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="meta"><span>${(p.nodes||[]).length} node</span><span>·</span><span>${dateStr}</span></div>
    `;
    card.addEventListener('click', (e)=>{
      if(e.target.closest('.delete-btn')) return;
      openProject(p.id);
    });
    card.querySelector('.delete-btn').addEventListener('click', (e)=>{
      e.stopPropagation();
      deleteProject(p.id);
    });
    projectGrid.appendChild(card);
  }
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

el('btn-new-project').addEventListener('click', async ()=>{
  const project = {
    id: uid(),
    name: 'Project baru',
    updatedAt: Date.now(),
    nodes: [],
    connections: []
  };
  await DB.put(project);
  state.projects.push(project);
  openProject(project.id);
});

async function deleteProject(id){
  const p = state.projects.find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`Hapus project "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  await DB.remove(id);
  state.projects = state.projects.filter(x=>x.id!==id);
  renderProjectList();
}

// ---------------- Open / Navigate ----------------
function openProject(id){
  state.currentProjectId = id;
  const p = state.projects.find(x=>x.id===id);
  titleInput.value = p.name;
  state.scale = 1; state.panX = 0; state.panY = 0;
  applyTransform();
  renderCanvasNodes();
  renderConnections();
  screenList.classList.remove('active');
  screenCanvas.classList.add('active');
}

el('btn-back').addEventListener('click', ()=>{
  screenCanvas.classList.remove('active');
  screenList.classList.add('active');
  renderProjectList();
});

titleInput.addEventListener('input', ()=>{
  const p = currentProject();
  if(!p) return;
  p.name = titleInput.value || 'Tanpa nama';
  scheduleSave();
});

function currentProject(){
  return state.projects.find(p=>p.id === state.currentProjectId);
}

// ---------------- Autosave ----------------
function scheduleSave(){
  saveText.textContent = 'Menyimpan…';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveNow, 500);
}
async function saveNow(){
  const p = currentProject();
  if(!p) return;
  p.updatedAt = Date.now();
  await DB.put(p);
  saveText.textContent = 'Tersimpan';
}

// manual save button uses same logic, but exposed as explicit action too
async function manualSave(){
  await saveNow();
  showToast('Project disimpan');
}

// ---------------- Canvas transform (zoom/pan) ----------------
function applyTransform(){
  canvasWorld.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
}

el('btn-zoom-in').addEventListener('click', ()=>{ state.scale = Math.min(2.2, state.scale + 0.15); applyTransform(); });
el('btn-zoom-out').addEventListener('click', ()=>{ state.scale = Math.max(0.35, state.scale - 0.15); applyTransform(); });
el('btn-zoom-reset').addEventListener('click', ()=>{ state.scale = 1; state.panX = 0; state.panY = 0; applyTransform(); });

// Pan via background drag (pointer) + pinch zoom (basic two-finger)
let pointers = new Map();
let pinchStartDist = null;
let pinchStartScale = 1;

canvasViewport.addEventListener('pointerdown', (e)=>{
  if(e.target.closest('.node') || e.target.closest('.port')) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pointers.size === 1){
    state.panState = {startX:e.clientX, startY:e.clientY, origPanX:state.panX, origPanY:state.panY};
  } else if(pointers.size === 2){
    const pts = [...pointers.values()];
    pinchStartDist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    pinchStartScale = state.scale;
    state.panState = null;
  }
  // deselect nodes
  document.querySelectorAll('.node.selected').forEach(n=>n.classList.remove('selected'));
});

let activeConnectionPointerId = null;

canvasViewport.addEventListener('pointermove', (e)=>{
  // Connection dragging and node dragging must work even if this pointer
  // was never registered via a viewport pointerdown (it may have started
  // on a port or node element whose own handler called stopPropagation).
  if(state.connectingFrom && e.pointerId === activeConnectionPointerId){
    updateTempConnection(e);
    return;
  }
  if(state.draggingNode){
    moveDraggingNode(e);
    return;
  }

  if(!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});

  if(pointers.size === 2 && pinchStartDist){
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    state.scale = Math.min(2.2, Math.max(0.35, pinchStartScale * (dist / pinchStartDist)));
    applyTransform();
    return;
  }

  if(state.panState && pointers.size === 1){
    const dx = e.clientX - state.panState.startX;
    const dy = e.clientY - state.panState.startY;
    state.panX = state.panState.origPanX + dx;
    state.panY = state.panState.origPanY + dy;
    applyTransform();
  }
});

function endPointer(e){
  pointers.delete(e.pointerId);
  if(pointers.size < 2) pinchStartDist = null;
  state.panState = null;
  if(state.draggingNode){
    finishDraggingNode();
  }
  if(state.connectingFrom && e.pointerId === activeConnectionPointerId){
    // Because the pointer is captured by canvasViewport, pointerup never
    // bubbles through the port/node under the finger. Find it manually.
    const targetEl = document.elementFromPoint(e.clientX, e.clientY);
    const targetNodeEl = targetEl ? targetEl.closest('.node') : null;
    if(targetNodeEl){
      const toNodeId = targetNodeEl.dataset.id;
      if(toNodeId && toNodeId !== state.connectingFrom.nodeId){
        completeConnection(toNodeId);
      } else {
        cancelConnection();
      }
    } else {
      cancelConnection();
    }
    activeConnectionPointerId = null;
  }
}
canvasViewport.addEventListener('pointerup', endPointer);
canvasViewport.addEventListener('pointercancel', endPointer);

// ---------------- Nodes ----------------
function renderCanvasNodes(){
  nodesLayer.innerHTML = '';
  const p = currentProject();
  if(!p) return;
  for(const node of p.nodes){
    nodesLayer.appendChild(buildNodeEl(node));
  }
}

function buildNodeEl(node){
  const div = document.createElement('div');
  div.className = 'node';
  div.style.left = node.x + 'px';
  div.style.top = node.y + 'px';
  div.dataset.id = node.id;

  let imgHtml = '';
  if(node.type === 'image' || node.type === 'mixed'){
    imgHtml = node.image
      ? `<div class="node-img-wrap"><img src="${node.image}" draggable="false"></div>`
      : `<div class="node-img-wrap placeholder-wrap"><svg class="placeholder" width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="10" r="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M21 15L16 10L5 19" stroke="currentColor" stroke-width="1.5"/></svg></div>`;
  }

  div.innerHTML = `
    <div class="node-body">
      ${imgHtml}
      <div class="node-text" contenteditable="true" data-placeholder="Tulis catatan…">${node.text ? escapeHtml(node.text) : ''}</div>
    </div>
    <div class="port port-in" data-role="in"></div>
    <div class="port port-out" data-role="out"></div>
    <div class="node-delete" data-role="delete">×</div>
  `;

  // Drag node (from body, not from ports/text)
  div.addEventListener('pointerdown', (e)=>{
    if(e.target.closest('.port') || e.target.closest('.node-text')) return;
    document.querySelectorAll('.node.selected').forEach(n=>n.classList.remove('selected'));
    div.classList.add('selected');
    e.stopPropagation();
    try{ canvasViewport.setPointerCapture(e.pointerId); }catch(err){}
    const rect = canvasWorld.getBoundingClientRect();
    state.draggingNode = node.id;
    state.dragOffset = {
      x: (e.clientX - rect.left)/state.scale - node.x,
      y: (e.clientY - rect.top)/state.scale - node.y
    };
  });

  div.querySelector('.node-text').addEventListener('pointerdown', (e)=> e.stopPropagation());
  div.querySelector('.node-text').addEventListener('input', (e)=>{
    node.text = e.target.textContent;
    scheduleSave();
  });

  div.querySelector('.node-delete').addEventListener('pointerdown', (e)=>{
    e.stopPropagation();
    deleteNode(node.id);
  });

  const portOut = div.querySelector('.port-out');
  const portIn = div.querySelector('.port-in');

  portOut.addEventListener('pointerdown', (e)=>{
    e.stopPropagation();
    e.preventDefault();
    startConnection(node.id, e);
    // Capture the pointer on the viewport so move/up keep firing
    // regardless of which element is under the finger/cursor.
    try{ canvasViewport.setPointerCapture(e.pointerId); }catch(err){}
    activeConnectionPointerId = e.pointerId;
  });

  portIn.addEventListener('pointerdown', (e)=>{
    e.stopPropagation();
    e.preventDefault();
  });

  return div;
}

function moveDraggingNode(e){
  const p = currentProject();
  const node = p.nodes.find(n=>n.id===state.draggingNode);
  if(!node) return;
  const rect = canvasWorld.getBoundingClientRect();
  node.x = (e.clientX - rect.left)/state.scale - state.dragOffset.x;
  node.y = (e.clientY - rect.top)/state.scale - state.dragOffset.y;
  const nodeEl = nodesLayer.querySelector(`.node[data-id="${node.id}"]`);
  if(nodeEl){ nodeEl.style.left = node.x+'px'; nodeEl.style.top = node.y+'px'; }
  renderConnections();
}

function finishDraggingNode(){
  state.draggingNode = null;
  scheduleSave();
}

function deleteNode(id){
  const p = currentProject();
  p.nodes = p.nodes.filter(n=>n.id!==id);
  p.connections = p.connections.filter(c=>c.from!==id && c.to!==id);
  renderCanvasNodes();
  renderConnections();
  scheduleSave();
}

function addNode(type){
  const p = currentProject();
  if(!p) return;
  // place new node near current view center
  const vw = canvasViewport.clientWidth, vh = canvasViewport.clientHeight;
  const centerX = (vw/2 - state.panX)/state.scale - 90;
  const centerY = (vh/2 - state.panY)/state.scale - 40;
  const node = {
    id: uid(),
    type,
    text: '',
    image: null,
    x: centerX + (Math.random()*40-20),
    y: centerY + (Math.random()*40-20)
  };
  p.nodes.push(node);
  nodesLayer.appendChild(buildNodeEl(node));
  scheduleSave();
}

el('btn-add-text').addEventListener('click', ()=> addNode('text'));
el('btn-add-image').addEventListener('click', ()=>{
  pendingImageNodeType = 'image';
  fileInput.value = '';
  fileInput.click();
});

let pendingImageNodeType = null;
fileInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const dataUrl = await compressImageToDataUrl(file, 720, 0.72);
  const p = currentProject();
  const vw = canvasViewport.clientWidth, vh = canvasViewport.clientHeight;
  const centerX = (vw/2 - state.panX)/state.scale - 90;
  const centerY = (vh/2 - state.panY)/state.scale - 60;
  const node = {
    id: uid(),
    type: 'image',
    text: '',
    image: dataUrl,
    x: centerX + (Math.random()*40-20),
    y: centerY + (Math.random()*40-20)
  };
  p.nodes.push(node);
  nodesLayer.appendChild(buildNodeEl(node));
  scheduleSave();
});

function compressImageToDataUrl(file, maxDim, quality){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = ()=>{ img.src = reader.result; };
    reader.onerror = reject;
    img.onload = ()=>{
      let {width, height} = img;
      if(width > maxDim || height > maxDim){
        if(width > height){ height = Math.round(height * maxDim/width); width = maxDim; }
        else { width = Math.round(width * maxDim/height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------- Connections ----------------
let tempConnectionTarget = null;
let tempConnectionCurrent = null;
let tempConnectionRAF = null;

function startConnection(nodeId, e){
  state.connectingFrom = {nodeId};
  const tempPath = document.createElementNS('http://www.w3.org/2000/svg','path');
  tempPath.setAttribute('class','connection-path temp');
  tempPath.id = 'temp-connection';
  svgLayer.appendChild(tempPath);

  const from = getPortWorldPos(nodeId, 'out');
  tempConnectionCurrent = {x: from.x, y: from.y};
  tempConnectionTarget = {x: from.x, y: from.y};

  const tick = ()=>{
    if(!state.connectingFrom){ tempConnectionRAF = null; return; }
    // ease toward target for a smooth, slightly trailing feel
    tempConnectionCurrent.x += (tempConnectionTarget.x - tempConnectionCurrent.x) * 0.45;
    tempConnectionCurrent.y += (tempConnectionTarget.y - tempConnectionCurrent.y) * 0.45;
    const path = document.getElementById('temp-connection');
    if(path){
      path.setAttribute('d', bezierPath(from.x, from.y, tempConnectionCurrent.x, tempConnectionCurrent.y));
    }
    tempConnectionRAF = requestAnimationFrame(tick);
  };
  tempConnectionRAF = requestAnimationFrame(tick);
}

function getPortWorldPos(nodeId, role){
  const p = currentProject();
  const node = p.nodes.find(n=>n.id===nodeId);
  const nodeEl = nodesLayer.querySelector(`.node[data-id="${nodeId}"]`);
  const w = nodeEl ? nodeEl.offsetWidth : 160;
  const h = nodeEl ? nodeEl.offsetHeight : 60;
  if(role === 'out') return {x: node.x + w, y: node.y + h/2};
  return {x: node.x, y: node.y + h/2};
}

function updateTempConnection(e){
  const rect = canvasWorld.getBoundingClientRect();
  const toX = (e.clientX - rect.left)/state.scale;
  const toY = (e.clientY - rect.top)/state.scale;
  tempConnectionTarget = {x: toX, y: toY};
}

function completeConnection(toNodeId){
  const p = currentProject();
  const fromId = state.connectingFrom.nodeId;
  if(fromId !== toNodeId && !p.connections.some(c=>c.from===fromId && c.to===toNodeId)){
    p.connections.push({id: uid(), from: fromId, to: toNodeId});
    scheduleSave();
  }
  cancelConnection();
  renderConnections();
}

function cancelConnection(){
  state.connectingFrom = null;
  if(tempConnectionRAF){ cancelAnimationFrame(tempConnectionRAF); tempConnectionRAF = null; }
  const tempPath = document.getElementById('temp-connection');
  if(tempPath) tempPath.remove();
}

function bezierPath(x1,y1,x2,y2){
  const dx = Math.max(60, Math.abs(x2-x1)*0.5);
  return `M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`;
}

function renderConnections(){
  const p = currentProject();
  if(!p) return;
  // clear all but keep temp if exists
  [...svgLayer.querySelectorAll('.connection-path:not(.temp), .connection-hit')].forEach(n=>n.remove());
  for(const c of p.connections){
    const from = getPortWorldPos(c.from, 'out');
    const to = getPortWorldPos(c.to, 'in');
    const d = bezierPath(from.x, from.y, to.x - 10, to.y);

    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('class','connection-hit');
    hit.setAttribute('d', d);
    hit.style.pointerEvents = 'stroke';
    hit.addEventListener('pointerdown', (e)=>{
      e.stopPropagation();
      if(confirm('Hapus koneksi ini?')){
        p.connections = p.connections.filter(x=>x.id!==c.id);
        renderConnections();
        scheduleSave();
      }
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('class','connection-path');
    path.setAttribute('d', d);
    path.setAttribute('marker-end','url(#arrowhead)');

    svgLayer.appendChild(path);
    svgLayer.appendChild(hit);
  }
}

// ---------------- Manual Save button (reuse export toolbar area) ----------------
// (Save happens automatically; title bar shows status. We also expose manual save via long-press title? 
// Simpler: tapping save-indicator triggers manual save.)
el('save-indicator').addEventListener('click', manualSave);
el('save-indicator').style.cursor = 'pointer';

// ---------------- Export PDF ----------------
el('btn-export-pdf').addEventListener('click', exportToPdf);

async function exportToPdf(){
  showToast('Menyiapkan PDF…');
  const p = currentProject();
  if(!p || p.nodes.length === 0){
    showToast('Canvas masih kosong');
    return;
  }

  // compute bounding box of all nodes
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  const nodeEls = {};
  p.nodes.forEach(n=>{
    const nodeEl = nodesLayer.querySelector(`.node[data-id="${n.id}"]`);
    const w = nodeEl ? nodeEl.offsetWidth : 160;
    const h = nodeEl ? nodeEl.offsetHeight : 60;
    nodeEls[n.id] = {w,h};
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x+w); maxY = Math.max(maxY, n.y+h);
  });
  const pad = 40;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const totalW = maxX-minX, totalH = maxY-minY;

  // build offscreen SVG snapshot
  const svgNS = 'http://www.w3.org/2000/svg';
  const exportSvg = document.createElementNS(svgNS,'svg');
  exportSvg.setAttribute('width', totalW);
  exportSvg.setAttribute('height', totalH);
  exportSvg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

  const bg = document.createElementNS(svgNS,'rect');
  bg.setAttribute('width','100%'); bg.setAttribute('height','100%'); bg.setAttribute('fill','#FAF8F4');
  exportSvg.appendChild(bg);

  // connections
  for(const c of p.connections){
    const fromNode = p.nodes.find(n=>n.id===c.from);
    const toNode = p.nodes.find(n=>n.id===c.to);
    if(!fromNode || !toNode) continue;
    const fw = nodeEls[fromNode.id].w, fh = nodeEls[fromNode.id].h;
    const th = nodeEls[toNode.id].h;
    const x1 = fromNode.x + fw - minX, y1 = fromNode.y + fh/2 - minY;
    const x2 = toNode.x - minX, y2 = toNode.y + th/2 - minY;
    const path = document.createElementNS(svgNS,'path');
    path.setAttribute('d', bezierPath(x1,y1,x2,y2));
    path.setAttribute('stroke','#D97757');
    path.setAttribute('stroke-width','2');
    path.setAttribute('fill','none');
    exportSvg.appendChild(path);
  }

  // nodes as foreignObject-free (rect + text + image) for reliable rasterization
  for(const n of p.nodes){
    const {w,h} = nodeEls[n.id];
    const x = n.x - minX, y = n.y - minY;
    const g = document.createElementNS(svgNS,'g');

    const rect = document.createElementNS(svgNS,'rect');
    rect.setAttribute('x',x); rect.setAttribute('y',y);
    rect.setAttribute('width',w); rect.setAttribute('height',h);
    rect.setAttribute('fill','#FFFFFF');
    rect.setAttribute('stroke','#E5DED2');
    rect.setAttribute('rx','2');
    g.appendChild(rect);

    let textY = y + 20;
    if(n.image){
      // use the actual rendered image height from the live node element
      const nodeEl = nodesLayer.querySelector(`.node[data-id="${n.id}"] img`);
      const imgH = nodeEl ? nodeEl.getBoundingClientRect().height / state.scale : w*0.625;
      const img = document.createElementNS(svgNS,'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink','href', n.image);
      img.setAttribute('x',x); img.setAttribute('y',y);
      img.setAttribute('width',w); img.setAttribute('height',imgH);
      img.setAttribute('preserveAspectRatio','xMidYMid meet');
      g.appendChild(img);
      textY = y + imgH + 20;
    }

    if(n.text){
      const words = n.text.split(' ');
      let line = '', lines = [];
      const maxCharsPerLine = Math.floor(w/7);
      for(const word of words){
        if((line+word).length > maxCharsPerLine){ lines.push(line); line = word+' '; }
        else line += word+' ';
      }
      if(line) lines.push(line);
      lines.slice(0,4).forEach((ln,i)=>{
        const text = document.createElementNS(svgNS,'text');
        text.setAttribute('x', x+12);
        text.setAttribute('y', textY + i*16);
        text.setAttribute('fill','#2B2620');
        text.setAttribute('font-size','12');
        text.setAttribute('font-family','sans-serif');
        text.textContent = ln.trim();
        g.appendChild(text);
      });
    }
    exportSvg.appendChild(g);
  }

  // serialize svg -> canvas -> pdf (via jsPDF loaded from CDN)
  const svgString = new XMLSerializer().serializeToString(exportSvg);
  const svgBlob = new Blob([svgString], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = async () => {
    const scaleFactor = 2; // retina export
    const canvas = document.createElement('canvas');
    canvas.width = totalW * scaleFactor;
    canvas.height = totalH * scaleFactor;
    const ctx = canvas.getContext('2d');
    ctx.scale(scaleFactor, scaleFactor);
    ctx.drawImage(img, 0, 0, totalW, totalH);
    URL.revokeObjectURL(url);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    await ensureJsPdfLoaded();
    const { jsPDF } = window.jspdf;
    const orientation = totalW > totalH ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit:'pt', format:[totalW, totalH] });
    pdf.addImage(imgData, 'JPEG', 0, 0, totalW, totalH);
    const fname = (currentProject().name || 'project-concept').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
    pdf.save(`${fname}.pdf`);
    showToast('PDF diunduh');
  };
  img.onerror = () => showToast('Gagal membuat PDF');
  img.src = url;
}

let jsPdfLoadPromise = null;
function ensureJsPdfLoaded(){
  if(window.jspdf) return Promise.resolve();
  if(jsPdfLoadPromise) return jsPdfLoadPromise;
  jsPdfLoadPromise = new Promise((resolve,reject)=>{
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return jsPdfLoadPromise;
}
