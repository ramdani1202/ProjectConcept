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
  nodes.forEach((n) => {
    const el = nodeElMap[n.id];
    const w = el ? el.offsetWidth : 160;
    const h = el ? el.offsetHeight : 60;
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

  for (const n of nodes) {
    const { w, h } = dims[n.id];
    const x = n.x - minX, y = n.y - minY;

    const fo = document.createElementNS(svgNS, 'foreignObject');
    fo.setAttribute('x', x); fo.setAttribute('y', y);
    fo.setAttribute('width', w); fo.setAttribute('height', h);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrapper.style.cssText = `
      width:${w}px; height:${h}px;
      background:#FFFFFF; border:1px solid #E5DED2; border-radius:14px;
      overflow:hidden; box-sizing:border-box;
      font-family:-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    `;

    if (n.image) {
      const imgTag = document.createElement('img');
      imgTag.src = n.image;
      imgTag.style.cssText = 'width:100%; height:auto; display:block;';
      wrapper.appendChild(imgTag);
    }

    if (n.text) {
      const textDiv = document.createElement('div');
      textDiv.style.cssText = `
        padding:12px 14px; font-size:13.5px; line-height:1.5;
        color:#2B2620; word-break:break-word; letter-spacing:-0.005em;
        white-space:pre-wrap;
      `;
      textDiv.textContent = n.text;
      wrapper.appendChild(textDiv);
    }

    fo.appendChild(wrapper);
    exportSvg.appendChild(fo);
  }

  const svgString = new XMLSerializer().serializeToString(exportSvg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const scaleFactor = 2;
      const canvas = document.createElement('canvas');
      canvas.width = totalW * scaleFactor;
      canvas.height = totalH * scaleFactor;
      const ctx = canvas.getContext('2d');
      ctx.scale(scaleFactor, scaleFactor);
      ctx.drawImage(img, 0, 0, totalW, totalH);
      URL.revokeObjectURL(url);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      try {
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
    img.onerror = reject;
    img.src = url;
  });
}
