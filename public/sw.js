/**
 * Retirement worker. This app has been replaced by Architech, and every page
 * now redirects there. Visitors who came before still have the old worker,
 * which answered from its cache and so would never see the redirect. The
 * browser fetches this file to check for updates, installs it, and it
 * clears every cache, unregisters itself and reloads open tabs, which then
 * reach the redirect.
 *
 * next.config.js must keep serving this file rather than redirecting it, or
 * the update check fails and the old worker stays.
 */
self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      const tabs = await self.clients.matchAll({ type: "window" })
      for (const tab of tabs) tab.navigate(tab.url)
    })(),
  )
})
