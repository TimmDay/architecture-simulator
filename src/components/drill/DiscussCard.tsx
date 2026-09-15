"use client"

import { useState } from "react"
import type { Card, Grade } from "~/drill/types"

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

/**
 * One card, typed out and self-graded.
 *
 * Extracted so Mix runs exactly the same card as Discuss rather than a second
 * implementation of it -- including the same grading callback, so both modes
 * feed one SM-2 schedule.
 *
 * Mount it with a key that changes per queue position. Its typed text and
 * flipped state are local, and a missed card is re-queued under the same id, so
 * keying on the id alone would carry a revealed answer into its own retry.
 */
export function DiscussCard({
  card,
  onGrade,
}: {
  card: Card
  onGrade: (grade: Grade) => void
}) {
  const [typed, setTyped] = useState("")
  const [flipped, setFlipped] = useState(false)

  return (
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
                {card.expands && (
                  <span className="text-pass block text-[12px]">
                    {card.expands}
                  </span>
                )}
                {card.answer}
                {card.note && (
                  <span className="text-fog mt-2 block text-[12px] leading-relaxed">
                    {card.note}
                  </span>
                )}
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
              {GRADES.map(({ grade, label, hint, className }) => (
                <button
                  key={grade}
                  onClick={() => onGrade(grade)}
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
  )
}
