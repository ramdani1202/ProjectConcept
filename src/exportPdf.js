import { bezierPath } from './utils.js';

let jsPdfLoadPromise = null;
function ensureJsPdfLoaded() {
  if (window.jspdf) return Promise.resolve();
  if (jsPdfLoadPromise) return jsPdfLoadPromise;
  jsPdfLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return jsPdfLoadPromise;
}

export async function exportProjectToPdf(project, nodeElMap) {
  const { nodes, connections, name } = project;
  if (!nodes.length) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const dims = {};

  // pre-measure text wrapping to compute accurate export height per node,
  // since a node's on-screen height (from the live app) may differ once
  // we re-wrap at export time — this prevents text overflowing the box.
  const measureCanvasPre = document.createElement('canvas');
  const measureCtxPre = measureCanvasPre.getContext('2d');
  measureCtxPre.font = '13.5px -apple-system, BlinkMacSystemFont, Inter, "Segoe UI", sans-serif';
  function preWrapLineCount(text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    let lines = 0, line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (measureCtxPre.measureText(test).width > maxWidth && line) {
        lines++;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines++;
    return Math.max(lines, 1);
  }

  nodes.forEach((n) => {
    const el = nodeElMap[n.id];
    const w = el ? el.offsetWidth : 160;
    let h = el ? el.offsetHeight : 60;

    if (n.text) {
      const lineCount = preWrapLineCount(n.text, w - 28);
      const imgEl = el ? el.querySelector('img') : null;
      const imgH = imgEl ? imgEl.getBoundingClientRect().height : 0;
      const neededH = imgH + 24 + lineCount * 19 + 14; // top offset + lines + bottom padding
      h = Math.max(h, neededH);
    }

    dims[n.id] = { w, h };
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  });
  const pad = 40;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const totalW = maxX - minX, totalH = maxY - minY;

  const svgNS = 'http://www.w3.org/2000/svg';
  const exportSvg = document.createElementNS(svgNS, 'svg');
  exportSvg.setAttribute('width', totalW);
  exportSvg.setAttribute('height', totalH);
  exportSvg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#FAF8F4');
  exportSvg.appendChild(bg);

  for (const c of connections) {
    const fromNode = nodes.find((n) => n.id === c.from);
    const toNode = nodes.find((n) => n.id === c.to);
    if (!fromNode || !toNode) continue;
    const fw = dims[fromNode.id].w, fh = dims[fromNode.id].h;
    const th = dims[toNode.id].h;
    const x1 = fromNode.x + fw - minX, y1 = fromNode.y + fh / 2 - minY;
    const x2 = toNode.x - minX, y2 = toNode.y + th / 2 - minY;
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', bezierPath(x1, y1, x2, y2));
    path.setAttribute('stroke', '#D97757');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    exportSvg.appendChild(path);
  }

  // Helper: wrap text into lines that actually fit the node width,
  // using a temporary canvas to measure real text width (accurate,
  // unlike the old fixed-chars-per-line guess that cut text off).
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = '13.5px -apple-system, BlinkMacSystemFont, Inter, "Segoe UI", sans-serif';
  const innerTextWidth = (w) => w - 28; // padding 14px each side

  function wrapText(text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (measureCtx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  for (const n of nodes) {
    const { w, h } = dims[n.id];
    const x = n.x - minX, y = n.y - minY;
    const g = document.createElementNS(svgNS, 'g');

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', h);
    rect.setAttribute('fill', '#FFFFFF');
    rect.setAttribute('stroke', '#E5DED2');
    rect.setAttribute('rx', '14');
    g.appendChild(rect);

    // clip so the image respects the rounded corners like in the app
    const clipId = `clip-${n.id}`;
    const clipPath = document.createElementNS(svgNS, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipRect = document.createElementNS(svgNS, 'rect');
    clipRect.setAttribute('x', x); clipRect.setAttribute('y', y);
    clipRect.setAttribute('width', w); clipRect.setAttribute('height', h);
    clipRect.setAttribute('rx', '14');
    clipPath.appendChild(clipRect);
    exportSvg.appendChild(clipPath);
    g.setAttribute('clip-path', `url(#${clipId})`);

    let textY = y + 24;
    if (n.image) {
      const imgEl = nodeElMap[n.id]?.querySelector('img');
      const imgH = imgEl ? imgEl.getBoundingClientRect().height : w * 0.625;
      const img = document.createElementNS(svgNS, 'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', n.image);
      img.setAttribute('x', x); img.setAttribute('y', y);
      img.setAttribute('width', w); img.setAttribute('height', imgH);
      img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      g.appendChild(img);
      textY = y + imgH + 24;
    }

    if (n.text) {
      const lines = wrapText(n.text, innerTextWidth(w));
      lines.forEach((ln, i) => {
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', x + 14);
        text.setAttribute('y', textY + i * 19);
        text.setAttribute('fill', '#2B2620');
        text.setAttribute('font-size', '13.5');
        text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, Inter, "Segoe UI", sans-serif');
        text.textContent = ln;
        g.appendChild(text);
      });
    }
    exportSvg.appendChild(g);
  }

  const svgString = new XMLSerializer().serializeToString(exportSvg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      reject(new Error('Export PDF timeout — proses render terlalu lama (kemungkinan gambar gagal dimuat di dalam SVG)'));
    }, 8000);

    const img = new Image();
    img.onload = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try {
        const scaleFactor = 2;
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
        const pdf = new jsPDF({ orientation, unit: 'pt', format: [totalW, totalH] });
        pdf.addImage(imgData, 'JPEG', 0, 0, totalW, totalH);
        const fname = (name || 'project-concept').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        pdf.save(`${fname}.pdf`);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar SVG untuk export (kemungkinan gambar di dalam node bermasalah)'));
    };
    img.src = url;
  });
}
