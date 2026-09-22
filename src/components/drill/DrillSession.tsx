"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, MessageSquare, Zap } from "lucide-react"
import { ALL_CARDS, CORE_CARDS } from "~/drill/cards"
import { buildQueue, type QueueItem } from "~/drill/queue"
import {
  DIFFICULTY_FILTERS,
  difficultyCounts,
  filterByDifficulty,
  type DifficultyFilter,
} from "~/drill/difficulty"
import {
  MIX_RATIO,
  afterDiscuss,
  afterSpeed,
  isDiscussDue,
  startMix,
} from "~/drill/mix"
import { newCardState, schedule, REQUEUE_GAP } from "~/drill/sm2"
import type { CardState, Grade } from "~/drill/types"
import { getProgressStore } from "~/storage"
import { DiscussCard } from "./DiscussCard"
import { MasteryStats } from "./MasteryStats"
import { SpeedSession } from "./SpeedSession"
import { TOPICS } from "~/topics"

type Mode = "speed" | "discuss" | "mix"

const MODES: [Mode, string, string][] = [
  ["speed", "MC", "Multiple choice, no typing"],
  ["discuss", "Discuss", "Type it out, then judge yourself"],
  ["mix", "Mix", `Speed, with a Discuss card every ${MIX_RATIO} or so`],
]

export function DrillSession() {
  /**
   * Speed leads and is the default: it is the mode you will open most, it needs
   * no warm-up, and it is what the ten minutes before an interview are for.
   *
   * The schedule is still built on Discuss, though, and that matters more than
   * the ordering here -- producing an answer from nothing is the skill being
   * measured, so it is the only thing allowed to push a review date out. Mix
   * exists because a session of pure Speed will quietly convince you that you
   * know things you cannot actually say out loud.
   */
  const [mode, setMode] = useState<Mode>("speed")
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all")
  const [states, setStates] = useState<Map<string, CardState> | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(0)
  const [mix, setMix] = useState(startMix)
  const [showDiscuss, setShowDiscuss] = useState(false)

  // A latest-value ref, so rebuilding the queue can read the card states
  // without taking a dependency on them -- every grade mutates that map, and a
  // rebuild on each grade would throw you back to the top of the queue.
  const statesRef = useRef<Map<string, CardState> | null>(null)
  statesRef.current = states

  // Hydrate from the progress store, seeding state for cards never seen.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const store = getProgressStore()
      const existing = await store.getCardStates()
      const map = new Map(existing.map((s) => [s.cardId, s]))
      const fresh: CardState[] = []
      // Vocabulary cards get state too -- a wrong answer in Speed still pulls
      // them forward -- they simply never enter the Discuss queue.
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
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ready = states !== null

  // Rebuild on the difficulty filter, and once when the states first land.
  // Changing difficulty starts a fresh session rather than filtering in place,
  // because a queue is an ordering as much as a set.
  useEffect(() => {
    const map = statesRef.current
    if (!map) return
    setQueue(buildQueue(filterByDifficulty(CORE_CARDS, difficulty), map))
    setIndex(0)
    setDone(0)
    setShowDiscuss(false)
  }, [difficulty, ready])

  const speedPool = useMemo(
    () => filterByDifficulty(ALL_CARDS, difficulty),
    [difficulty],
  )
  // Counted over the pool the current mode actually draws from. Discuss never
  // queues vocabulary, so counting it here would promise 55 cards that mode
  // cannot show you.
  const counts = useMemo(
    () => difficultyCounts(mode === "discuss" ? CORE_CARDS : ALL_CARDS),
    [mode],
  )

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
      setIndex((i) => i + 1)
    },
    [current, states, index],
  )

  /** Mix: a Discuss card is owed, and there is one to give. */
  const owesDiscuss = isDiscussDue(mix) && current !== undefined

  const onSpeedAnswered = useCallback(() => setMix(afterSpeed), [])
  const onSpeedAdvance = useCallback(() => {
    // Interrupt on the way out of a question rather than on top of one, so
    // coming back from the Discuss card lands on a fresh question.
    if (owesDiscuss) setShowDiscuss(true)
  }, [owesDiscuss])

  const gradeInMix = useCallback(
    (g: Grade) => {
      void grade(g)
      setMix(afterDiscuss)
      setShowDiscuss(false)
    },
    [grade],
  )

  const controls = (
    <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
      <Segmented
        options={MODES}
        value={mode}
        onChange={(m) => {
          setMode(m)
          setShowDiscuss(false)
        }}
      />
      <Segmented
        options={DIFFICULTY_FILTERS.map(
          ([value, label, hint]) =>
            [value, `${label} ${counts[value]}`, hint] as [
              DifficultyFilter,
              string,
              string,
            ],
        )}
        value={difficulty}
        onChange={setDifficulty}
        small
      />
    </div>
  )

  if (!states) {
    return (
      <div className="text-fog mx-auto max-w-3xl px-6 py-20 text-sm">
        Loading deck…
      </div>
    )
  }

  if (mode === "mix") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        {controls}

        {/*
          Hidden rather than unmounted. The running score and streak are real
          state, and at one Discuss card in five a remount would zero them
          every minute or so.
        */}
        <div
          hidden={showDiscuss}
          className={showDiscuss ? "hidden" : undefined}
        >
          <SpeedSession
            cards={speedPool}
            states={states}
            onAnswered={onSpeedAnswered}
            onAdvance={onSpeedAdvance}
          />
        </div>

        {showDiscuss && current && (
          <div>
            <div className="text-accent mb-3 flex items-center gap-2 text-xs font-medium">
              <MessageSquare size={13} />
              Say this one out loud
            </div>
            <div className="text-fog mb-4 flex items-center justify-between text-xs">
              <span>{done + 1} discussed this session</span>
              <span className="flex gap-1.5">
                {current.card.topicIds.map((t) => (
                  <span key={t} className="bg-panel-2 rounded px-1.5 py-0.5">
                    {TOPICS[t].label}
                  </span>
                ))}
              </span>
            </div>
            <DiscussCard
              key={`${current.card.id}:${index}`}
              card={current.card}
              onGrade={gradeInMix}
            />
          </div>
        )}

        {!showDiscuss && !current && (
          <p className="text-fog/60 mt-4 text-[11px] leading-relaxed">
            Nothing is due in the Discuss queue, so this is running as plain
            Speed until something falls due.
          </p>
        )}

        <MasteryStats cards={CORE_CARDS} states={states} />
      </div>
    )
  }

  // Speed mode draws on the whole deck rather than the due queue: it is for
  // volume and for the minutes before an interview, not for the schedule.
  if (mode === "speed") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        {controls}
        <SpeedSession cards={speedPool} states={states} />
        <MasteryStats cards={CORE_CARDS} states={states} />
      </div>
    )
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {controls}
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
        <MasteryStats cards={CORE_CARDS} states={states} />
      </div>
    )
  }

  const { card } = current
  const enqueued = current.state.enqueuedBy

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {controls}

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

      <DiscussCard
        key={`${card.id}:${index}`}
        card={card}
        onGrade={(g) => void grade(g)}
      />

      <MasteryStats cards={CORE_CARDS} states={states} />
    </div>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: [T, string, string][]
  value: T
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div
      role="radiogroup"
      className="border-line bg-panel inline-flex rounded-lg border p-0.5"
    >
      {options.map(([v, label, hint]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          title={hint}
          className={`rounded-md font-medium transition-colors ${
            small ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-[12px]"
          } ${value === v ? "bg-panel-2 text-chalk" : "text-fog hover:text-chalk"}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
