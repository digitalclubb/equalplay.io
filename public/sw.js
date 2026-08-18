// Service worker. Cache-first strategy for offline support.
// Cache name includes a version so we can bust stale caches on deploy.
const CACHE_NAME = "equalplay-v5";

// The build output filenames are hashed, so we cache them at runtime
// rather than listing them statically. We pre-cache only the shell.
const PRECACHE_URLS = ["/", "/planner", "/hub"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  // Activate immediately instead of waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove old caches when a new version activates
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  // Claim all open clients so the new SW takes effect immediately
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests. Let others pass through
  if (request.method !== "GET") return;

  // For navigation requests, try network first so users get fresh HTML,
  // then fall back to cache for offline support
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // For all other assets (JS, CSS, images): stale-while-revalidate. Answer from
  // cache for speed, but always refresh behind it. The build hashes JS, but
  // pages.css and the icons are served at stable URLs and plain cache-first
  // would pin those to a stale copy until the next CACHE_NAME bump.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });

      if (!cached) return fresh;

      // Let the refresh finish after we've already replied; offline simply
      // means we keep serving what we had.
      event.waitUntil(fresh.catch(() => {}));
      return cached;
    }),
  );
});
