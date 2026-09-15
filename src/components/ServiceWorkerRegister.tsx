"use client"

import { useEffect } from "react"

/**
 * Registers the offline service worker once the app has hydrated.
 *
 * Skipped outside production: a dev server rebuilds constantly, and a worker
 * serving yesterday's cached bundle over today's hot-reloaded one is a worse
 * experience than no worker at all.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js")
  }, [])

  return null
}
