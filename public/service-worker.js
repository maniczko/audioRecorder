/* eslint-disable no-restricted-globals */
// Service Worker for VoiceLog OS
// Cache-first strategy for assets, network-first for API

const CACHE_NAME = 'voicelog-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg'];

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
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
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

  // Skip API requests and cross origin requests
  if (url.includes('/api/') || !url.startsWith(self.location.origin)) {
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
          // Network failed, return offline page if available
          return caches.match('/index.html');
        });

      return cachedResponse || fetchPromise;
    })
  );
});
