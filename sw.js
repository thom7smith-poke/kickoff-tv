// App shell from cache; game data network-first with cached fallback so the app opens offline.
const CACHE = 'kickoff-v2';
const SHELL = ['./', 'index.html', 'app.js', 'watch.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const api = e.request.url.includes('site.api.espn.com');
  e.respondWith(api
    ? fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
        .catch(() => caches.match(e.request))
    : caches.match(e.request).then(r => r || fetch(e.request)));
});
