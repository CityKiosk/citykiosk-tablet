// Souvenirs Berlin — manual service worker
// Strategy:
//  - HTML/navigation: network-first, fallback to cached shell, fallback to /catalog
//  - /_next/static, /_next/image, /products/*: cache-first
//  - Other GET requests: stale-while-revalidate
// Bump CACHE_VERSION to invalidate old caches.

const CACHE_VERSION = "v8";
const SHELL_CACHE = `souvenir-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `souvenir-assets-${CACHE_VERSION}`;
const RUNTIME_CACHE = `souvenir-runtime-${CACHE_VERSION}`;

// Only pre-cache static assets that never change between deploys. HTML
// routes are deliberately excluded — a pre-cached /catalog would keep
// serving HTML that references old JS chunk hashes after a deploy,
// making users stuck on a stale feature bundle until they manually
// clear cache. Navigation now goes to the network every time with
// /offline.html as the true-offline fallback.
const SHELL_URLS = ["/manifest.webmanifest", "/offline.html", "/logo-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            fetch(url, { cache: "reload" })
              .then((res) => (res.ok ? cache.put(url, res) : null))
              .catch(() => null)
          )
        )
      )
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
            .filter((k) => ![SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/products/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: ALWAYS network. We intentionally do NOT fall back to a
  // cached copy of the same URL — that produced the "stuck on old bundle"
  // bug, because a cached /catalog HTML referenced chunk hashes from a
  // previous deploy, and the browser then loaded those old chunks from
  // the asset cache, freezing users on a stale feature version. Only
  // /offline.html is used as a fallback, and only when the network
  // actually fails.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const offline = await caches.match("/offline.html");
        if (offline) return offline;
        return new Response(
          "Offline. Please check your connection.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      })
    );
    return;
  }

  // Assets: cache-first
  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached || Response.error());
        })
      )
    );
    return;
  }

  // Other: stale-while-revalidate. Fall back to Response.error() if both
  // cache and network are empty so we never resolve with undefined.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || fetchPromise;
      })
    )
  );
});
