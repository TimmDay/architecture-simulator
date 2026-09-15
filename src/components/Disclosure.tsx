"use client"

import { useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"

/**
 * A section you have to ask for.
 *
 * Detail that is always open is detail you always have to scroll past, and a
 * dashboard earns its keep by answering one question at a glance. The summary
 * row carries enough to decide whether opening it is worth it.
 */
export function Disclosure({
  title,
  meta,
  icon,
  defaultOpen = false,
  children,
}: {
  title: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-chalk hover:text-accent flex w-full items-center gap-2 text-[15px] font-medium transition-colors"
      >
        <ChevronRight
          size={14}
          className={`text-fog shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {icon}
        {title}
        {meta && (
          <span className="text-fog/60 ml-auto text-[11px]">{meta}</span>
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
