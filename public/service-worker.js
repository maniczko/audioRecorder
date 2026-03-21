const CACHE_NAME = "voicelog-os-v3";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/favicon.ico", "/logo192.png", "/logo512.png"];

function isHttpRequest(url) {
  return String(url?.protocol || "").startsWith("http");
}

function shouldSkipRequest(requestUrl) {
  const appOrigin = self.location?.origin;
  return (
    (appOrigin && requestUrl.origin !== appOrigin) ||
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.port === "4000" ||
    requestUrl.port === "4001"
  );
}

function isCacheableResponse(response) {
  return Boolean(
    response &&
      response.ok &&
      !response.bodyUsed &&
      (response.type === "basic" || response.type === "cors")
  );
}

async function cacheResponse(request, response) {
  if (!isCacheableResponse(response)) return;

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("Service worker cache skipped.", request.url, error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (!isHttpRequest(requestUrl) || shouldSkipRequest(requestUrl)) {
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        const networkResponsePromise = fetch(event.request)
          .then(async (networkResponse) => {
            await cacheResponse(event.request, networkResponse);
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || networkResponsePromise || fetch(event.request);
      })
    );
    return;
  }

  if (event.request.mode === "navigate" || requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await cacheResponse(event.request, response);
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || caches.match("/index.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      const networkResponse = await fetch(event.request);
      await cacheResponse(event.request, networkResponse);
      return networkResponse;
    })
  );
});
