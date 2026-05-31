const CACHE_NAME = "kingapp-pwa-v2";
const OFFLINE_URL = "/offline.html";
const APP_ROUTES = [
  "/login",
  "/dashboard",
  "/loading",
  "/confirm-loading",
  "/sales",
  "/returns",
  "/cash",
  "/expenses",
  "/inventory",
  "/daily-report",
  "/reports",
  "/sync-status"
];
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  ...APP_ROUTES
];

function normalizeRoute(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  return pathname === "/" ? "/login" : pathname;
}

async function cacheResponse(request, response) {
  if (!response || !response.ok || response.type === "opaque") {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());

  return response;
}

async function getCachedPage(request) {
  const cache = await caches.open(CACHE_NAME);
  const route = normalizeRoute(request);

  return (
    (await cache.match(request)) ||
    (await cache.match(route)) ||
    (APP_ROUTES.includes(route) ? await cache.match(route) : null)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      getCachedPage(request).then((cachedPage) => {
        const networkPage = fetch(request)
          .then((response) => cacheResponse(request, response))
          .catch(() => cachedPage || caches.match(OFFLINE_URL));

        return cachedPage || networkPage;
      })
    );
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request)
        .then((response) => cacheResponse(request, response))
        .catch(() => cachedResponse || Response.error());

      if (cachedResponse) {
        event.waitUntil(networkResponse);
        return cachedResponse;
      }

      return networkResponse;
    })
  );
});
