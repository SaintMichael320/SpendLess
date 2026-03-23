// ── SPENDLESS SERVICE WORKER ──
// Update this version number any time you make changes to the app.
// This forces the cache to refresh for all users automatically.
const CACHE_VERSION = 'spendless-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json'
];

// ── INSTALL ──
// Fires when the service worker is first registered.
// Pre-caches all app files so the app works offline.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── ACTIVATE ──
// Fires after install. Cleans up any old cache versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── FETCH ──
// Intercepts every network request.
// Strategy: Cache first, fall back to network.
// This means the app loads instantly and works offline.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
