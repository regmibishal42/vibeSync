// Hand-rolled service worker (no Workbox/Serwist) — kept deliberately small and
// explicit. Next.js 16 builds with Turbopack by default, and Turbopack build
// fails outright if a custom webpack config is present (which every current
// webpack-based PWA plugin injects), so bundler-driven SW generation isn't a
// safe fit for this stack yet. A dependency-free SW also keeps the whole PWA
// layer auditable in one file and adds zero bytes to the JS bundle.
//
// CACHE_VERSION is stamped by scripts/inject-sw-version.ts (a `postbuild`
// step, see package.json) with the actual Next.js build ID. SHELL_ASSETS
// below use stable, non-hashed URLs (/offline.html, the manifest, two icon
// PNGs) — without an auto-bumped version, a content change to any of those
// across a deploy would never get evicted by `activate`'s cleanup below,
// and a repeat visitor could be stuck on a stale offline page indefinitely.
const CACHE_VERSION = "__CACHE_VERSION__";
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
    (async () => {
      // Lets the browser start a navigation's network request in parallel
      // with SW boot instead of waiting for the worker to finish starting
      // up first — pure latency win, changes nothing about what's served
      // (still always-network for navigations, see the fetch handler below).
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
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
  // Prefers the navigation-preload response (started during SW boot, see
  // the activate handler above) over issuing a second fetch.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          return preloaded ?? (await fetch(request));
        } catch {
          return caches.match("/offline.html");
        }
      })()
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
