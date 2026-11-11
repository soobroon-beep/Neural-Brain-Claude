/* Neural Brain · service worker: la app abre sin internet, pero siempre busca primero la versión nueva. */
const CACHE = 'neural-brain-v6';
const ASSETS = ['./', './index.html', './brain-learn.js', './graphs.js', './neura.js', './manifest.json', './icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Firebase, IA y fuentes: directo a la red
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
