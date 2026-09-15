"use client"

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import { masteryByDomain, masteryTotals } from "~/drill/mastery"
import type { Card, CardState } from "~/drill/types"

/**
 * Where you stand, out of the way.
 *
 * Collapsed by default: the card is the point of the page, and a wall of bars
 * under it competes for the attention the card is asking for. The collapsed
 * header still carries the one number worth glancing at.
 */
export function MasteryStats({
  cards,
  states,
}: {
  cards: Card[]
  states: Map<string, CardState>
}) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => masteryByDomain(cards, states), [cards, states])
  const total = useMemo(() => masteryTotals(rows), [rows])

  if (rows.length === 0) return null

  return (
    <div className="border-line mt-10 border-t pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-fog hover:text-chalk flex w-full items-center gap-2 text-xs font-medium tracking-wide uppercase transition-colors"
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        />
        Mastery stats
        <span className="text-fog/50 ml-auto text-[11px] normal-case">
          {total.mastered}/{total.cards} mastered
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="text-fog/50 mb-1.5 flex items-center gap-3 text-[10px]">
            <span className="w-36 shrink-0" />
            <span className="w-7 text-right">Cards</span>
            <span className="flex-1" />
            <span className="w-20 text-right">New · Learning · Known</span>
          </div>

          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.domain} className="flex items-center gap-3">
                <span className="text-fog w-36 shrink-0 truncate text-[11px]">
                  {r.label}
                </span>
                <span className="text-fog/60 w-7 text-right text-[11px] tabular-nums">
                  {r.cards}
                </span>
                <span className="bg-panel-2 flex h-1.5 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-pass h-full"
                    style={{ width: `${(r.mastered / r.cards) * 100}%` }}
                  />
                  <span
                    className="bg-warn h-full"
                    style={{ width: `${(r.learning / r.cards) * 100}%` }}
                  />
                </span>
                <span className="w-20 text-right font-mono text-[11px] tabular-nums">
                  <span className="text-fog/50">{r.new}</span>
                  <span className="text-fog/30"> · </span>
                  <span className="text-warn">{r.learning}</span>
                  <span className="text-fog/30"> · </span>
                  <span className="text-pass">{r.mastered}</span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-fog/50 mt-3 text-[10px] leading-relaxed">
            Scheduled cards only — vocabulary is Speed-only and never enters the
            review queue. A card counts once, under its primary topic, and moves
            out of New only when you have graded yourself on it in Discuss.
          </p>
        </div>
      )}
    </div>
  )
}
