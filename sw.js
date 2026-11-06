// Funciona sin conexión: primero red (para recibir cambios), si falla, la copia guardada.
const C = 'deutsch-v5';
const SHELL = ['./', 'index.html', 'style.css?v=5', 'app.js?v=5', 'games.js?v=5', 'config.js?v=5', 'manifest.webmanifest', 'icon-192.png',
  'data/words.json', 'data/grammar.json', 'data/aussprache.json', 'data/course.json', 'data/boxen.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || /supabase\.co$/.test(u.hostname)) return;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !font) return;
  if (font) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cl = res.clone(); caches.open(C).then(c => c.put(e.request, cl)); return res; }))); return; }
  e.respondWith(fetch(e.request, {cache: 'no-cache'}).then(res => { if (res.ok) { const cl = res.clone(); caches.open(C).then(c => c.put(e.request, cl)); } return res; }).catch(() => caches.match(e.request, {ignoreSearch: false}).then(r => r || caches.match('index.html'))));
});
