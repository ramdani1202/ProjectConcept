const CACHE_NAME = 'project-concept-v3';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const isSameOrigin = event.request.url.startsWith(self.location.origin);

  // network-first for everything same-origin (HTML, JS, CSS, manifest, icons):
  // always try to get the latest file first, fall back to cache only if offline.
  if (isSameOrigin) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request).then((cached) => {
        return cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined);
      }))
    );
    return;
  }

  // cross-origin (e.g. jsPDF CDN): cache-first is fine, these are versioned URLs
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
