"use client"

import { usePathname } from "next/navigation"
import { DONATE_URL } from "~/lib/donate"

/**
 * Not rendered on a scenario workspace.
 *
 * `BuildWorkspace` fills the viewport below the nav exactly, so anything after
 * it adds a scrollbar to a page built not to have one -- and the canvas is the
 * last place to be nudging the viewport around.
 */
function hiddenOn(pathname: string): boolean {
  return /^\/build\/[^/]+$/.test(pathname)
}

export function Footer() {
  const pathname = usePathname()
  if (hiddenOn(pathname)) return null

  return (
    <footer className="border-line text-fog/50 mt-16 border-t">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-5 text-[11px]">
        <span>Architecture Simulator</span>
        <span className="text-fog/25">·</span>
        <span>Free, and your progress stays in your browser</span>
        {DONATE_URL && (
          <>
            <span className="text-fog/25">·</span>
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-chalk underline underline-offset-2 transition-colors"
            >
              Buy me a coffee
            </a>
          </>
        )}
      </div>
    </footer>
  )
}
