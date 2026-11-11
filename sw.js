// IAI Field Sales Dashboard: service worker.
// Caches the app files so the app opens fast and works offline. It never touches saved data
// (that stays in this browser) and it ignores every request that goes to another website.
const CACHE = 'iai-fsd-v1-r5';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.json',
  'js/engine.js', 'js/core.js', 'js/map.js', 'js/ui.js', 'js/work.js', 'js/leads.js',
  'js/territory.js', 'js/dashboard.js', 'js/pipeline.js', 'js/settings.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Map tiles, building search and address search go straight to the network.
  // They are only ever sent after the person has allowed them, and are never cached here.
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // network first, so a new version arrives whenever the phone is online
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html')));
  } else {
    // network first for the app's own files too, falling back to the saved copy offline
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
  }
});
