const CACHE_NAME = "kingapp-pwa-v3";
const OFFLINE_URL = "/offline.html";
const APP_ROUTES = [
  "/",
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
  "/sync-status",
  "/debug-offline"
];
const APP_SHELL_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/favicon.png",
  ...APP_ROUTES
];

function normalizePath(requestOrUrl) {
  const url =
    typeof requestOrUrl === "string"
      ? new URL(requestOrUrl, self.location.origin)
      : new URL(requestOrUrl.url);
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  return pathname;
}

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function shouldCacheResponse(response) {
  return response && response.ok && response.type !== "opaque";
}

async function putInCache(request, response) {
  if (!shouldCacheResponse(response)) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  console.log("[KingApp PWA] Page cached", request.url || request);

  return response;
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.allSettled(
    APP_SHELL_URLS.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });

      if (shouldCacheResponse(response)) {
        await cache.put(url, response);
        console.log("[KingApp PWA] Page cached", url);
      }
    })
  );
}

async function getCachedNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const pathname = normalizePath(request);

  return (
    (await cache.match(request)) ||
    (await cache.match(pathname)) ||
    (pathname === "/" ? await cache.match("/login") : null)
  );
}

async function staleWhileRevalidateNavigation(event) {
  const request = event.request;
  const cachedPage = await getCachedNavigation(request);
  const networkPage = fetch(request)
    .then((response) => putInCache(request, response))
    .catch(async () => {
      if (cachedPage) {
        return cachedPage;
      }

      console.log("[KingApp PWA] Offline fallback used", request.url);
      return caches.match(OFFLINE_URL);
    });

  if (cachedPage) {
    event.waitUntil(networkPage.catch(() => undefined));
  }

  return cachedPage || networkPage;
}

async function cacheFirstAsset(request) {
  const cachedAsset = await caches.match(request);

  if (cachedAsset) {
    return cachedAsset;
  }

  const response = await fetch(request);
  return putInCache(request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
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
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET" || !isSameOrigin(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidateNavigation(event));
    return;
  }

  event.respondWith(cacheFirstAsset(request));
});
