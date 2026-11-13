const CACHE_NAME = 'lifegame-hybrid-v2.0.1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './domain.js',
  './views-home-day.js',
  './views-map-rooms.js',
  './app.js',
  './pwa.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './assets/journey.jpg',
  './assets/ai-card.jpg',
  './fonts/golos-text-cyrillic-wght-normal.woff2',
  './fonts/golos-text-latin-wght-normal.woff2',
  './fonts/jetbrains-mono-cyrillic-wght-normal.woff2',
  './fonts/jetbrains-mono-latin-wght-normal.woff2',
  './fonts/unbounded-cyrillic-wght-normal.woff2',
  './fonts/unbounded-latin-wght-normal.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
