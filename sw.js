
// sw.js - Service Worker con gestione aggiornamenti e pulizia cache profonda

const CACHE_NAME = 'trailcoach-v2.1'; // Incrementato per forzare l'aggiornamento su iOS

// Lista dei file da salvare in cache per l'utilizzo offline
const FILES_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './piano-locale.js',
  './piano-ai.js',
  './ui.js',
  './piano-aggiornamento.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// 1. Installazione: Creazione della cache e salvataggio dei file aggiornati
self.addEventListener('install', evt => {
  console.log('[Service Worker] Installazione della nuova versione:', CACHE_NAME);
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Salvataggio dei file in cache...');
      return cache.addAll(FILES_TO_CACHE);
    }).then(() => {
      // Forza il Service Worker attivo a prendere il controllo immediatamente senza aspettare il riavvio
      return self.skipWaiting();
    })
  );
});

// 2. Attivazione: Eliminazione automatica di tutte le vecchie cache obsolete
self.addEventListener('activate', evt => {
  console.log('[Service Worker] Attivazione in corso...');
  evt.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Rimozione vecchia cache obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Permette al Service Worker di controllare immediatamente la pagina aperta
      return self.clients.claim();
    })
  );
});

// 3. Fetch: Strategia Network-First con fallback su Cache (Ottimale per PWA in sviluppo)
// Questa strategia cerca prima il file aggiornato su Internet. Se sei offline, usa la cache salvata.
self.addEventListener('fetch', evt => {
  // Ignoriamo le richieste non HTTP/HTTPS (es. estensioni o schemi strani)
  if (!evt.request.url.startsWith('http')) return;

  evt.respondWith(
    fetch(evt.request)
      .then(networkResponse => {
        // Se la richiesta di rete va a buon fine, aggiorna la cache e restituisce il file aggiornato
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(evt.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se la rete fallisce (es. sei offline o in montagna), recupera il file dalla cache
        return caches.match(evt.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se non è presente nemmeno in cache, fallisce in sicurezza
          return new Response('Connessione assente e risorsa non presente in cache.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

```
