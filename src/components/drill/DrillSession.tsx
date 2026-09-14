"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, RotateCcw, Zap } from "lucide-react"
import { ALL_CARDS } from "~/drill/cards"
import { buildQueue, topicStrength, type QueueItem } from "~/drill/queue"
import { newCardState, schedule, REQUEUE_GAP } from "~/drill/sm2"
import type { CardState, Grade } from "~/drill/types"
import { getProgressStore } from "~/storage"
import { SpeedSession } from "./SpeedSession"
import { DOMAINS, TOPICS, type DomainId } from "~/topics"

const GRADES: {
  grade: Grade
  label: string
  hint: string
  className: string
}[] = [
  {
    grade: "again",
    label: "Again",
    hint: "Missed it",
    className: "bg-fail/15 text-fail hover:bg-fail/25",
  },
  {
    grade: "hard",
    label: "Hard",
    hint: "Close",
    className: "bg-warn/15 text-warn hover:bg-warn/25",
  },
  {
    grade: "good",
    label: "Good",
    hint: "Got it",
    className: "bg-pass/15 text-pass hover:bg-pass/25",
  },
  {
    grade: "easy",
    label: "Easy",
    hint: "Instant",
    className: "bg-accent/15 text-accent hover:bg-accent/25",
  },
]

type Mode = "discuss" | "speed"

export function DrillSession() {
  /**
   * Discuss is the default because producing an answer is the harder skill and
   * the one the schedule is built on. Speed is for volume and for the minutes
   * before an interview.
   */
  const [mode, setMode] = useState<Mode>("discuss")
  const [states, setStates] = useState<Map<string, CardState> | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState("")
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  // Hydrate from the progress store, seeding state for cards never seen.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const store = getProgressStore()
      const existing = await store.getCardStates()
      const map = new Map(existing.map((s) => [s.cardId, s]))
      const fresh: CardState[] = []
      for (const card of ALL_CARDS) {
        if (!map.has(card.id)) {
          const s = newCardState(card.id)
          map.set(card.id, s)
          fresh.push(s)
        }
      }
      if (fresh.length) await store.saveCardStates(fresh)
      if (cancelled) return
      setStates(map)
      setQueue(buildQueue(ALL_CARDS, map))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const current = queue[index]

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || !states) return
      const next = schedule(current.state, g)
      const map = new Map(states)
      map.set(next.cardId, next)
      setStates(map)
      void getProgressStore().saveCardState(next)

      setQueue((q) => {
        if (g !== "again") return q
        // Re-queue a missed card a few positions later in this same session, so
        // you get a second attempt while it is still fresh.
        const rest = q.slice(index + 1)
        const at = Math.min(REQUEUE_GAP, rest.length)
        const copy = [...q]
        copy.splice(index + 1 + at, 0, { ...current, state: next })
        return copy
      })

      setDone((d) => d + 1)
      setTyped("")
      setFlipped(false)
      setIndex((i) => i + 1)
    },
    [current, states, index],
  )

  const mastery = useMemo(
    () =>
      states ? topicStrength(ALL_CARDS, states) : new Map<string, number>(),
    [states],
  )

  const modeSwitch = (
    <div className="border-line bg-panel mb-5 inline-flex rounded-lg border p-0.5">
      {(
        [
          ["discuss", "Discuss", "Type it out, then judge yourself"],
          ["speed", "Speed", "Multiple choice, no typing"],
        ] as const
      ).map(([value, label, hint]) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          title={hint}
          className={`rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
            mode === value
              ? "bg-panel-2 text-chalk"
              : "text-fog hover:text-chalk"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (!states) {
    return (
      <div className="text-fog mx-auto max-w-3xl px-6 py-20 text-sm">
        Loading deck…
      </div>
    )
  }

  // Speed mode draws on the whole deck rather than the due queue: it is for
  // volume and for the minutes before an interview, not for the schedule.
  if (mode === "speed") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        {modeSwitch}
        <SpeedSession cards={ALL_CARDS} states={states} />
        <MasteryGrid mastery={mastery} />
      </div>
    )
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="border-line bg-panel rounded-xl border p-8 text-center">
          <Check className="text-pass mx-auto" size={28} />
          <h2 className="text-chalk mt-4 text-xl font-medium">
            {done > 0
              ? `Session complete — ${done} cards`
              : "Nothing due right now"}
          </h2>
          <p className="text-fog mt-2 text-sm">
            {done > 0
              ? "Scheduling is updated. Come back when cards fall due."
              : "Every card is scheduled ahead. Build something and fail a rule to pull cards forward."}
          </p>
        </div>
        <MasteryGrid mastery={mastery} />
      </div>
    )
  }

  const { card } = current
  const enqueued = current.state.enqueuedBy

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {modeSwitch}

      <div className="text-fog mb-4 flex items-center justify-between text-xs">
        <span>
          {done + 1} / {queue.length} this session
          {current.isNew && (
            <span className="text-accent ml-2">· new card</span>
          )}
        </span>
        <span className="flex gap-1.5">
          {card.topicIds.map((t) => (
            <span key={t} className="bg-panel-2 rounded px-1.5 py-0.5">
              {TOPICS[t].label}
            </span>
          ))}
        </span>
      </div>

      {enqueued && (
        <div className="border-warn/30 bg-warn/10 text-warn mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
          <Zap size={13} className="mt-0.5 shrink-0" />
          <span>
            Pulled forward because <code>{enqueued.ruleId}</code> failed in{" "}
            <strong>{enqueued.scenarioId}</strong>.
          </span>
        </div>
      )}

      <div className="border-line bg-panel rounded-xl border p-6">
        <p className="text-chalk text-[17px] leading-relaxed font-medium">
          {card.prompt}
        </p>

        {/* The textarea is replaced by the comparison on flip rather than being
            disabled in place -- leaving it would show your answer twice. */}
        {!flipped ? (
          <>
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              placeholder="Answer from memory. Write it out — recognising an answer is not the same as producing one."
              className="border-line bg-ink text-chalk placeholder:text-fog/50 focus:border-accent mt-5 h-32 w-full resize-none rounded-lg border p-3 text-sm leading-relaxed outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  setFlipped(true)
              }}
            />
            <button
              onClick={() => setFlipped(true)}
              className="bg-accent/15 text-accent hover:bg-accent/25 mt-3 w-full rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Reveal answer <span className="opacity-60">⌘↵</span>
            </button>
          </>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-fog mb-1.5 text-xs font-medium tracking-wide uppercase">
                  What you wrote
                </h3>
                <p className="border-line bg-ink text-chalk/80 min-h-24 rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {typed || <span className="text-fog/50">(nothing)</span>}
                </p>
              </div>
              <div>
                <h3 className="text-pass mb-1.5 text-xs font-medium tracking-wide uppercase">
                  Model answer
                </h3>
                <p className="border-pass/25 bg-pass/5 text-chalk min-h-24 rounded-lg border p-3 text-sm leading-relaxed">
                  {card.answer}
                </p>
              </div>
            </div>

            {card.emFraming && (
              <div className="border-line bg-panel-2 rounded-lg border p-3">
                <h3 className="text-accent mb-1.5 text-xs font-medium tracking-wide uppercase">
                  The manager&apos;s angle
                </h3>
                <p className="text-chalk/80 text-sm leading-relaxed">
                  {card.emFraming}
                </p>
              </div>
            )}

            <div>
              <p className="text-fog mb-2 text-xs">
                Be honest — the schedule is only as good as this.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map(({ grade: g, label, hint, className }) => (
                  <button
                    key={g}
                    onClick={() => void grade(g)}
                    className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${className}`}
                  >
                    {label}
                    <span className="block text-[10px] font-normal opacity-70">
                      {hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <MasteryGrid mastery={mastery} />
    </div>
  )
}

function MasteryGrid({ mastery }: { mastery: Map<string, number> }) {
  const domains = Object.keys(DOMAINS) as DomainId[]
  const covered = domains.filter((d) =>
    Object.entries(TOPICS).some(([id, t]) => t.domain === d && mastery.has(id)),
  )
  if (covered.length === 0) return null

  return (
    <div className="mt-10">
      <h3 className="text-fog mb-3 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        <RotateCcw size={12} /> Mastery
      </h3>
      <div className="space-y-2">
        {covered.map((d) => {
          const topics = Object.entries(TOPICS).filter(
            ([id, t]) => t.domain === d && mastery.has(id),
          )
          const avg =
            topics.reduce((s, [id]) => s + (mastery.get(id) ?? 0), 0) /
            topics.length
          return (
            <div key={d} className="flex items-center gap-3">
              <span className="text-fog w-40 shrink-0 text-xs">
                {DOMAINS[d]}
              </span>
              <div className="bg-panel-2 h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full rounded-full transition-all"
                  style={{ width: `${Math.max(2, avg * 100)}%` }}
                />
              </div>
              <span className="text-fog/60 w-9 text-right text-[11px]">
                {Math.round(avg * 100)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
