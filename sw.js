// ============================================================
// Keshav's Learning Adventure – Service Worker
// Cache-first strategy: game works 100% offline after first load
// ============================================================

const CACHE_NAME = 'keshav-learn-v1';

// All assets we need to cache on install
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png',
  './icon-maskable-512.png',
  // Google Fonts – cache for offline use
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@500;600;700&display=swap',
];

// ── Install: pre-cache everything we can ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache local assets (must succeed)
      const localUrls = PRECACHE_URLS.filter(u => !u.startsWith('http'));
      await cache.addAll(localUrls);

      // Cache external resources (best-effort; don't block install if offline)
      const externalUrls = PRECACHE_URLS.filter(u => u.startsWith('http'));
      await Promise.allSettled(externalUrls.map(url =>
        fetch(url, { mode: 'cors' })
          .then(res => res.ok ? cache.put(url, res) : null)
          .catch(() => null)
      ));

      return self.skipWaiting(); // activate immediately
    })
  );
});

// ── Activate: delete old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, then network, then fallback ──────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-http(s) schemes (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache → try network
      return fetch(event.request.clone()).then(response => {
        // Cache successful responses for future offline use
        if (response && response.status === 200) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => {
        // Network failed AND not in cache → return the app shell
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // For fonts: return a transparent response so layout doesn't break
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});

// ── Background sync: notify clients about updates ─────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
