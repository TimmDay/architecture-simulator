/**
 * Minimal offline cache for the app shell.
 *
 * Same-origin GET requests only: cross-origin traffic (Firestore, Vercel
 * Analytics) passes straight through untouched, since replaying a stale read
 * from a database is worse than no cache at all.
 *
 * Cache-first with a background revalidate: a repeat visit renders instantly
 * from cache, and the next fetch picks up whatever changed.
 */
const CACHE = "arch-sim-v1"

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches
              .open(CACHE)
              .then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        .catch(() => cached)
      return cached ?? network
    }),
  )
})
