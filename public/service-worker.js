/* eslint-disable no-restricted-globals */
// Service Worker for VoiceBóbr
// Cache static assets only. Never cache the HTML shell because it embeds
// runtime config such as remote/local provider mode.

const CACHE_NAME = 'voicelog-assets-v2';
const STATIC_ASSETS = ['/manifest.json', '/favicon.ico', '/favicon.png', '/logo192.png'];
const BACKEND_PREFIXES = [
  '/api/',
  '/auth/',
  '/users/',
  '/workspaces/',
  '/state/',
  '/voice-profiles',
  '/media/',
  '/transcribe',
  '/ai/',
  '/health',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Handle messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name.startsWith('voicelog'))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(url);

  if (
    event.request.mode === 'navigate' ||
    requestUrl.pathname === '/' ||
    requestUrl.pathname === '/index.html'
  ) {
    return;
  }

  // Skip Vite HMR and chunk requests in development
  if (
    url.includes('/src/') ||
    url.includes('.tsx') ||
    url.includes('.ts') ||
    url.includes('@vite') ||
    url.includes('@react-refresh') ||
    url.includes('node_modules')
  ) {
    return;
  }

  // Skip WebSocket requests
  if (url.startsWith('ws:') || url.startsWith('wss:')) {
    return;
  }

  // Skip API/backend rewrite requests and cross origin requests.
  if (
    !url.startsWith(self.location.origin) ||
    BACKEND_PREFIXES.some(
      (prefix) => requestUrl.pathname === prefix || requestUrl.pathname.startsWith(prefix)
    )
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
