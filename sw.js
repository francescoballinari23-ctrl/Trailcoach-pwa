const CACHE_NAME = 'trailcoach-v0.2'; // <- Incrementa il numero della versione (es. da v17 a v18) per forzare l'iPhone a scaricare i file nuovi

const assets = [
  '/',
  '/index.html',
  '/app.js',
  '/piano-locale.js',
  '/piano-ai.js',
  '/ui.js',
  '/manifest.json',
  '/icon-192.png.jpeg',
  '/icon-512.png.jpeg'
];

// ... resto del tuo codice del service worker ...

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(resp => resp || fetch(evt.request))
  );
});
