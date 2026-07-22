// Hand-rolled service worker (no Workbox/Serwist) — kept deliberately small and
// explicit. Next.js 16 builds with Turbopack by default, and Turbopack build
// fails outright if a custom webpack config is present (which every current
// webpack-based PWA plugin injects), so bundler-driven SW generation isn't a
// safe fit for this stack yet. A dependency-free SW also keeps the whole PWA
// layer auditable in one file and adds zero bytes to the JS bundle.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `vibesync-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vibesync-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Supabase/API calls or auth routes — financial and
  // session data must always come from the network, never a stale cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // App-shell navigations: network-first, offline fallback page on failure.
  // Deliberately not falling back to a cached page here — showing a stale
  // balance/shift screen while offline is worse than an explicit offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Static, hashed build assets: cache-first, safe to keep indefinitely.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
