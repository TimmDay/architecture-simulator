"use client"

import { useEffect, useRef, useState } from "react"
import { Trophy, X } from "lucide-react"
import type { TimerState } from "~/lib/pomodoro"
import {
  GOAL_LENGTHS,
  MAX_POMS,
  MIN_POMS,
  goalProgress,
  newGoal,
  type Goal,
  type GoalDays,
} from "~/lib/goal"

const KEY = "architecture-simulator:pomodoro-goal:v1"

function load(): Goal | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Goal) : null
  } catch {
    return null
  }
}

function save(goal: Goal | null) {
  try {
    if (goal) window.localStorage.setItem(KEY, JSON.stringify(goal))
    else window.localStorage.removeItem(KEY)
  } catch {
    // Blocked storage. The goal lasts this session and no longer.
  }
}

/**
 * A goal, worn as a ring of dots around a trophy.
 *
 * One dot per day, filling in as each day's quota is met, and the trophy turns
 * gold only when every one of them has. It is deliberately the whole display:
 * a streak is a shape you should be able to read without stopping to count,
 * and a number would invite you to do arithmetic instead of work.
 */
export function GoalTrophy({ timer, now }: { timer: TimerState; now: number }) {
  const [goal, setGoal] = useState<Goal | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => setGoal(load()), [])

  const progress = goal ? goalProgress(goal, timer, new Date(now)) : null
  const complete = progress?.complete ?? false

  const commit = (next: Goal | null) => {
    setGoal(next)
    save(next)
    setOpen(false)
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setOpen(true)}
        aria-label={
          goal
            ? `Goal: ${progress?.met ?? 0} of ${goal.days} days done. Open goal setting.`
            : "Set a pomodoro goal"
        }
        className="hover:text-chalk relative flex h-8 w-8 items-center justify-center rounded-md transition-colors"
      >
        {progress && <DotRing progress={progress} />}
        <Trophy
          size={14}
          className={
            complete ? "text-[#e3b341]" : goal ? "text-fog" : "text-fog/45"
          }
          fill={complete ? "#e3b341" : "none"}
        />
      </button>

      {open && (
        <GoalDialog
          goal={goal}
          onClose={() => setOpen(false)}
          onSave={commit}
          onClear={() => commit(null)}
        />
      )}
    </div>
  )
}

/**
 * The dots sit on a circle around the icon rather than in a row, so the shape
 * itself says how far round you are. Twelve o'clock is day one and it runs
 * clockwise, which is the only arrangement nobody has to be told.
 */
function DotRing({
  progress,
}: {
  progress: NonNullable<ReturnType<typeof goalProgress>>
}) {
  const n = progress.days.length
  const r = 12.2
  const size = 32
  const c = size / 2
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      {progress.days.map((d, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2
        return (
          <circle
            key={d.key}
            cx={c + r * Math.cos(angle)}
            cy={c + r * Math.sin(angle)}
            r={n > 7 ? 1.3 : 1.7}
            className={d.met ? "fill-pass" : "fill-line"}
          />
        )
      })}
    </svg>
  )
}

function GoalDialog({
  goal,
  onClose,
  onSave,
  onClear,
}: {
  goal: Goal | null
  onClose: () => void
  onSave: (goal: Goal) => void
  onClear: () => void
}) {
  const [days, setDays] = useState<GoalDays>(goal?.days ?? 7)
  const [poms, setPoms] = useState(goal?.pomsPerDay ?? 2)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-24"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Goal setting"
        onClick={(e) => e.stopPropagation()}
        className="border-line bg-panel mx-4 w-full max-w-xs rounded-xl border p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-chalk text-[14px] font-medium">Goal setting</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-fog hover:text-chalk transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-fog text-[11px] tracking-wide uppercase">
            Run for
          </legend>
          <div className="mt-1.5 flex gap-1.5">
            {GOAL_LENGTHS.map((d, i) => (
              <button
                key={d}
                ref={i === 0 ? first : undefined}
                role="radio"
                aria-checked={days === d}
                onClick={() => setDays(d)}
                className={`flex-1 rounded-lg border py-1.5 text-[12px] transition-colors ${
                  days === d
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-line text-fog hover:text-chalk"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label
            htmlFor="poms-per-day"
            className="text-fog text-[11px] tracking-wide uppercase"
          >
            Sessions per day
          </label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              id="poms-per-day"
              type="range"
              min={MIN_POMS}
              max={MAX_POMS}
              value={poms}
              onChange={(e) => setPoms(Number(e.target.value))}
              className="accent-accent flex-1"
            />
            <span className="text-chalk w-6 text-right font-mono text-[13px] tabular-nums">
              {poms}
            </span>
          </div>
          <p className="text-fog/60 mt-1.5 text-[10px] leading-relaxed">
            {poms * 25} minutes a day, {days} days running. A day counts only
            when its sessions are done — they do not carry over.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSave(newGoal(days, poms))}
            className="bg-accent/15 text-accent hover:bg-accent/25 flex-1 rounded-lg py-2 text-[12px] font-medium transition-colors"
          >
            {goal ? "Start again" : "Set goal"}
          </button>
          {goal && (
            <button
              onClick={onClear}
              className="border-line text-fog hover:text-chalk rounded-lg border px-3 py-2 text-[12px] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {goal && (
          <p className="text-fog/50 mt-2.5 text-[10px]">
            Starting again resets the streak to today.
          </p>
        )}
      </div>
    </div>
  )
}
