"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PomodoroTimer } from "./PomodoroTimer"
import { Boxes, ChartNoAxesColumn, Home, Layers } from "lucide-react"

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/drill", label: "Drill", icon: Layers },
  { href: "/build", label: "Build", icon: Boxes },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="border-line bg-panel/60 sticky top-0 z-50 h-[var(--nav-h)] border-b backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-1 px-3 sm:px-4">
        <span className="text-chalk mr-2 text-sm font-semibold tracking-tight max-[360px]:hidden sm:mr-4">
          {/* The wordmark, four links and the timer don't all fit at narrow
              widths. The second word drops first below sm; the smallest
              phones (below 360px) drop the whole wordmark, and Home is one
              tap away regardless. */}
          Architecture
          <span className="text-accent max-sm:hidden">Sim</span>
        </span>
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                active ? "bg-panel-2 text-chalk" : "text-fog hover:text-chalk"
              }`}
            >
              <Icon size={14} />
              {/*
                Labels are dropped on a phone: the wordmark, three links and
                the timer do not fit in 390px, and the row overflowed
                horizontally. Icons stay, and the name stays for a screen
                reader.
              */}
              <span className="max-sm:sr-only">{label}</span>
            </Link>
          )
        })}

        <PomodoroTimer />
      </div>
    </nav>
  )
}
