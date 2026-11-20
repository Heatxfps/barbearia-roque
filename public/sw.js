// Service worker simples: guarda os arquivos para o app abrir offline.
const CACHE = 'roque-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // dados da API sempre frescos (horários livres mudam a todo momento)
  if (new URL(e.request.url).pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const c = res.clone(); caches.open(CACHE).then((cache) => cache.put(e.request, c)); return res; })
      .catch(() => caches.match(e.request))
  );
});
