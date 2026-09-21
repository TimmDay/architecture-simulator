"use client"

import { useCallback, useMemo, useState } from "react"
import { ArrowRight, Check, RotateCcw, Shuffle, X } from "lucide-react"
import type { Card, CardState } from "~/drill/types"
import {
  optionsFor,
  pullForward,
  recordSpeedAnswer,
  speedItems,
  weightedOrder,
  tallySpeed,
  EMPTY_STATS,
  type SpeedItem,
} from "~/drill/speed"
import { getProgressStore } from "~/storage"
import { TOPICS } from "~/topics"

type Props = {
  cards: Card[]
  states: Map<string, CardState>
  /** Fired when a question is answered -- Mix counts these towards its ratio. */
  onAnswered?: () => void
  /** Fired when moving on, which is where Mix slots its Discuss card in. */
  onAdvance?: () => void
}

type DeckFilter = "all" | "core" | "vocabulary"

const DECK_TABS: [DeckFilter, string, string][] = [
  ["all", "Everything", "Concepts and vocabulary together"],
  ["core", "Concepts", "Mechanisms and trade-offs"],
  ["vocabulary", "Vocabulary", "One-line definitions of the terms"],
]

export function SpeedSession({ cards, states, onAnswered, onAdvance }: Props) {
  const [deck, setDeck] = useState<DeckFilter>("all")
  // Built once. A card with three variants contributes three questions, and
  // no two questions about the same card sit next to each other.
  const order = useMemo(
    () =>
      weightedOrder(
        speedItems(
          cards.filter((c) => deck === "all" || (c.deck ?? "core") === deck),
        ),
        Math.random,
      ),
    [cards, deck],
  )
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [stats, setStats] = useState(EMPTY_STATS)
  // The card state AFTER the answer was recorded, held so the review-queue
  // button can build on it. Re-reading the `states` map would fetch the
  // pre-answer copy -- `pick` saves to the store and never writes back to the
  // map -- and flagging that would silently undo the tally just written.
  const [answeredState, setAnsweredState] = useState<CardState | null>(null)

  const item = order[index % Math.max(1, order.length)]
  const card = item?.card
  const options = useMemo(() => (item ? optionsFor(item) : []), [item])

  const advance = useCallback(
    (random: boolean) => {
      setPicked(null)
      setAnsweredState(null)
      onAdvance?.()
      if (random) {
        // A different card, not merely the next one -- drilling in a fixed order
        // teaches the order as much as the material.
        setIndex((i) => {
          if (order.length < 2) return i
          let next = i
          while (next === i) next = Math.floor(Math.random() * order.length)
          return next
        })
      } else {
        setIndex((i) => (i + 1) % Math.max(1, order.length))
      }
    },
    [order.length, onAdvance],
  )

  const pick = useCallback(
    (text: string) => {
      if (picked || !card) return
      setPicked(text)
      const correct = options.find((o) => o.text === text)?.correct ?? false
      setStats((s) => tallySpeed(s, correct))
      const state = states.get(card.id)
      if (state) {
        const next = recordSpeedAnswer(state, correct)
        setAnsweredState(next)
        if (next !== state) void getProgressStore().saveCardState(next)
      }
      onAnswered?.()
    },
    [picked, card, options, states, onAnswered],
  )

  /**
   * "I got that right and I do not believe myself."
   *
   * The answer stays counted as correct -- the tally `pick` already wrote is
   * what gets flagged, not a second recording of the same question -- but the
   * card comes back tomorrow regardless. Recognition among four options is the
   * one place a lucky guess is indistinguishable from knowledge from the
   * outside, so this is the only honest signal available, and it has to be the
   * cheapest button on the screen or it will not get pressed.
   */
  const queueForReview = useCallback(() => {
    if (answeredState) {
      void getProgressStore().saveCardState(pullForward(answeredState))
    }
    advance(false)
  }, [answeredState, advance])

  if (!item || !card) {
    return <p className="text-fog text-sm">No cards available.</p>
  }

  const answered = picked !== null
  const gotItRight = answered && options.find((o) => o.text === picked)?.correct
  /*
    Vocabulary cards are Speed-only by design -- the Discuss queue is built
    from CORE_CARDS -- so flagging one would move a due date nothing ever
    reads. A button that does nothing on a third of the deck is worse than no
    button, so it is hidden there rather than shipped inert.
  */
  const canQueue =
    gotItRight &&
    answeredState !== null &&
    (card.deck ?? "core") !== "vocabulary"

  return (
    <div>
      <div className="border-line bg-panel mb-4 inline-flex rounded-lg border p-0.5">
        {DECK_TABS.map(([value, label, hint]) => (
          <button
            key={value}
            onClick={() => {
              setDeck(value)
              setIndex(0)
              setPicked(null)
            }}
            title={hint}
            className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
              deck === value
                ? "bg-panel-2 text-chalk"
                : "text-fog hover:text-chalk"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="text-fog mb-4 flex items-center justify-between text-xs">
        <span>
          {stats.answered > 0 ? (
            <>
              {stats.right}/{stats.answered} correct
              {stats.streak > 1 && (
                <span className="text-pass ml-2">{stats.streak} in a row</span>
              )}
            </>
          ) : (
            <>Pick the answer. Nothing to type.</>
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

      <div className="border-line bg-panel rounded-xl border p-6">
        <p className="text-chalk text-[17px] leading-relaxed font-medium">
          {item.variant.question ?? card.prompt}
        </p>

        {/* Grouped so the four options read as one control rather than four
            unrelated buttons -- and so a test can find them without guessing
            which buttons on the card are answers. */}
        <div
          role="group"
          aria-label="Answer options"
          className="mt-5 space-y-2"
        >
          {options.map((o) => {
            const chosen = picked === o.text
            const reveal = answered && o.correct
            const wrongChoice = chosen && !o.correct

            const tone = reveal
              ? "border-pass bg-pass/10 text-chalk"
              : wrongChoice
                ? "border-fail bg-fail/10 text-chalk"
                : answered
                  ? "border-line text-fog/60"
                  : "border-line text-chalk hover:border-accent/60 hover:bg-panel-2"

            return (
              <button
                key={o.text}
                onClick={() => pick(o.text)}
                disabled={answered}
                className={`flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left text-[13px] leading-relaxed transition-colors ${tone}`}
              >
                <span className="mt-0.5 w-4 shrink-0">
                  {reveal && <Check size={14} className="text-pass" />}
                  {wrongChoice && <X size={14} className="text-fail" />}
                </span>
                <span>{o.text}</span>
              </button>
            )
          })}
        </div>

        {answered && (
          <div className="mt-5">
            <p
              className={`text-[13px] font-medium ${gotItRight ? "text-pass" : "text-fail"}`}
            >
              {gotItRight
                ? "Correct."
                : "Not quite — this one comes back tomorrow."}
            </p>
            <p className="text-fog mt-2 text-[12px] leading-relaxed">
              {/* Knowing what an SLO *is* while not knowing it is a Service
                  Level Objective is a gap you find out loud, in the one room
                  where finding it is expensive. */}
              {card.expands && (
                <span className="text-chalk/80">{card.expands} — </span>
              )}
              {card.answer}
            </p>
            {card.note && (
              <p className="text-fog/70 mt-1.5 text-[11px] leading-relaxed">
                {card.note}
              </p>
            )}
            {/* Wraps rather than shrinks: three labelled buttons do not fit
                across a phone, and a clipped "Next card" is worse than a
                second row. */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => advance(false)}
                className="bg-accent/15 text-accent hover:bg-accent/25 flex flex-1 basis-32 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Next card <ArrowRight size={13} />
              </button>
              {canQueue && (
                <button
                  onClick={queueForReview}
                  title="Counts as correct, but brings the card back tomorrow anyway"
                  className="border-line text-fog hover:text-chalk hover:border-fog/50 flex flex-1 basis-32 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition-colors"
                >
                  <RotateCcw size={13} /> Review queue
                </button>
              )}
              <button
                onClick={() => advance(true)}
                title="Jump somewhere else in the deck"
                className="border-line text-fog hover:text-chalk hover:border-fog/50 flex flex-1 basis-24 items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm transition-colors"
              >
                <Shuffle size={13} /> Random
              </button>
            </div>
          </div>
        )}

        {!answered && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => advance(false)}
              className="border-line text-fog hover:text-chalk hover:border-fog/50 flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] transition-colors"
            >
              Skip <ArrowRight size={12} />
            </button>
            <button
              onClick={() => advance(true)}
              className="border-line text-fog hover:text-chalk hover:border-fog/50 flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-[12px] transition-colors"
            >
              <Shuffle size={12} /> Random
            </button>
          </div>
        )}
      </div>

      <p className="text-fog/60 mt-4 text-[11px] leading-relaxed">
        Getting one right here does not push its review date out — recognising
        an answer among four is weaker evidence than producing it from nothing,
        and letting it count would quietly inflate every interval in your deck.
        Getting one wrong does pull the card forward, and{" "}
        <strong className="text-fog/80">Review queue</strong> does the same to a
        right answer you do not believe.
      </p>
    </div>
  )
}
