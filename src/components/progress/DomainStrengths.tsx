"use client"

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import { domainStrengths, type TopicStrength } from "~/drill/progress"
import { TOPICS } from "~/topics"

const BAND_BG = {
  strong: "bg-pass",
  medium: "bg-warn",
  weak: "bg-panel-2",
} as const

/**
 * Strength per domain, with the topics folded away behind each row.
 *
 * This replaced a flat list of all 166 topics. That list was honest and
 * unreadable: the one question anyone brings to it -- "where am I weakest?" --
 * cannot be answered by scanning 166 chips, and a bar can answer it without
 * being read at all. Domains are also the unit a study session gets chosen at,
 * so it is the right level to summarise at.
 */
export function DomainStrengths({ strengths }: { strengths: TopicStrength[] }) {
  const rows = useMemo(() => domainStrengths(strengths), [strengths])
  const [open, setOpen] = useState<string | null>(null)

  const total = rows.reduce(
    (t, r) => ({
      strong: t.strong + r.strong,
      medium: t.medium + r.medium,
      weak: t.weak + r.weak,
    }),
    { strong: 0, medium: 0, weak: 0 },
  )
  const topics = total.strong + total.medium + total.weak

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-chalk text-[15px] font-medium">By domain</h2>
        <div className="text-fog/60 flex items-center gap-3 text-[11px]">
          <Key className="bg-pass" label={`${total.strong} holding`} />
          <Key className="bg-warn" label={`${total.medium} shaky`} />
          <Key className="bg-panel-2" label={`${total.weak} cold`} />
        </div>
      </div>

      <Bar {...total} of={topics} className="mt-2 h-2" />
      <p className="text-fog mt-2 text-[12px]">
        Weakest first. Strength combines how long a card has held with how hard
        it has been — a card relearned five times should not look like one never
        forgotten. Open a domain for its topics.
      </p>

      <div className="divide-line border-line mt-3 divide-y rounded-lg border">
        {rows.map((r) => {
          const isOpen = open === r.domain
          return (
            <div key={r.domain}>
              <button
                onClick={() => setOpen(isOpen ? null : r.domain)}
                aria-expanded={isOpen}
                className="hover:bg-panel flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
              >
                <ChevronRight
                  size={12}
                  className={`text-fog/50 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <span className="text-chalk w-44 shrink-0 truncate text-[12px]">
                  {r.label}
                </span>
                <Bar
                  strong={r.strong}
                  medium={r.medium}
                  weak={r.weak}
                  of={r.topics.length}
                  className="h-1.5 flex-1"
                />
                <span className="text-fog/50 w-14 shrink-0 text-right text-[10px] tabular-nums">
                  {r.topics.length} topics
                </span>
              </button>

              {isOpen && (
                <div className="flex flex-wrap gap-1 px-3 pt-1 pb-3 pl-[4.7rem]">
                  {r.topics.map((t) => (
                    <span
                      key={t.topic}
                      title={`${Math.round(t.strength * 100)}% — ${t.seen}/${t.cards} cards seen`}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        t.strength > 0.66
                          ? "border-pass/50 text-pass"
                          : t.strength > 0.25
                            ? "border-warn/50 text-warn"
                            : "border-line text-fog/70"
                      }`}
                    >
                      {TOPICS[t.topic].label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Bar({
  strong,
  medium,
  weak,
  of,
  className = "",
}: {
  strong: number
  medium: number
  weak: number
  of: number
  className?: string
}) {
  const pct = (n: number) => (of === 0 ? 0 : (n / of) * 100)
  return (
    <span
      className={`bg-panel-2 flex overflow-hidden rounded-full ${className}`}
    >
      {(["strong", "medium", "weak"] as const).map((b) => {
        const n = b === "strong" ? strong : b === "medium" ? medium : weak
        return (
          <span
            key={b}
            className={BAND_BG[b]}
            style={{ width: `${pct(n)}%` }}
          />
        )
      })}
    </span>
  )
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  )
}
