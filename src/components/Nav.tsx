"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PomodoroTimer } from "./PomodoroTimer"
import { Boxes, ChartNoAxesColumn, Layers } from "lucide-react"

/*
 * Two groups, because they are two kinds of thing.
 *
 * Drill and Build are where the work happens, so they sit beside the
 * wordmark. Progress belongs with the timer and the goal trophy: all three
 * are about how the studying is going rather than about doing any, and
 * grouping them puts every instrument in one corner.
 *
 * No Home entry either way -- the wordmark is the way back, as on most sites.
 */
const LINKS = [
  { href: "/drill", label: "Drill", icon: Layers },
  { href: "/build", label: "Build", icon: Boxes },
]

const TRACKING_LINKS = [
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="border-line bg-panel/60 sticky top-0 z-50 h-[var(--nav-h)] border-b backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-1.5 px-3 sm:gap-2.5 sm:px-4">
        {/*
          The wordmark is now the only route home, so unlike before it stays
          visible at every width -- hiding it below 360px was safe while a
          Home link existed and would strand you without one. Dropping that
          link is what pays for it: it freed more width than the wordmark
          needs. "Sim" still goes first, below sm.
        */}
        <Link
          href="/"
          className="text-chalk hover:text-accent mr-1 shrink-0 text-sm font-semibold tracking-tight transition-colors sm:mr-3"
        >
          Architecture
          <span className="text-accent max-sm:hidden">Sim</span>
        </Link>
        {LINKS.map((l) => (
          <NavLink key={l.href} {...l} pathname={pathname} />
        ))}

        {/*
          `ml-auto` lives here rather than on the timer, which used to carry
          it. A component that pushes itself to one end cannot be grouped
          with anything -- it would have shoved itself away from Progress.
          Positioning is the nav's business; the timer's is the timer.
        */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          {TRACKING_LINKS.map((l) => (
            <NavLink key={l.href} {...l} pathname={pathname} />
          ))}
          <PomodoroTimer />
        </div>
      </div>
    </nav>
  )
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string
  label: string
  icon: typeof Layers
  pathname: string
}) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors sm:px-3.5 ${
        active ? "bg-panel-2 text-chalk" : "text-fog hover:text-chalk"
      }`}
    >
      <Icon size={14} />
      {/*
        Labels are dropped on a phone: the wordmark, the links and the timer
        do not fit in 390px, and the row overflowed horizontally. Icons stay,
        and the name stays for a screen reader.
      */}
      <span className="max-sm:sr-only">{label}</span>
    </Link>
  )
}
