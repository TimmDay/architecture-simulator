"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
    <nav className="border-line bg-panel/60 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-2.5">
        <span className="text-chalk mr-4 text-sm font-semibold tracking-tight">
          Architecture<span className="text-accent">Simulator</span>
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
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
