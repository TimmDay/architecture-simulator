"use client"

import { useCallback, useEffect, useState } from "react"
import { Coffee, Play, X } from "lucide-react"
import {
  BREAK_MINUTES,
  FOCUS_MINUTES,
  IDLE,
  formatRemaining,
  remainingMinutes,
  start,
  stop,
  tabTitle,
  tick,
  type TimerState,
} from "~/lib/pomodoro"

const KEY = "architecture-simulator:pomodoro:v1"
const BASE_TITLE = "Architecture Simulator"

function load(): TimerState {
  if (typeof window === "undefined") return IDLE
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? { ...IDLE, ...(JSON.parse(raw) as Partial<TimerState>) } : IDLE
  } catch {
    return IDLE
  }
}

function save(state: TimerState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private window or blocked storage. The timer still runs for this session.
  }
}

/**
 * A study timer in the nav.
 *
 * It lives here rather than on a page so that it survives moving between Drill
 * and Build -- the layout does not remount on navigation, and a timer that
 * resets when you go and look at a scenario is useless for studying.
 *
 * It is persisted as an end timestamp, so a reload mid-session picks the timer
 * back up where it was rather than starting again.
 */
export function PomodoroTimer() {
  const [state, setState] = useState<TimerState>(IDLE)
  const [hydrated, setHydrated] = useState(false)
  /**
   * A clock that changes every second.
   *
   * `tick` returns the SAME state object while a phase is simply running, so
   * setState alone bails out of the re-render -- which froze the countdown at
   * its starting value and let Next's metadata win the tab title back. The
   * timer's correctness still comes from the end timestamp; this exists purely
   * to make the component redraw.
   */
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setState(tick(load()))
    setHydrated(true)
  }, [])

  // One second is for the display only; correctness comes from the end
  // timestamp, so a throttled background tab loses nothing.
  useEffect(() => {
    if (!hydrated) return
    const id = window.setInterval(() => {
      setNow(Date.now())
      setState((s) => tick(s))
    }, 1000)
    return () => window.clearInterval(id)
  }, [hydrated])

  useEffect(() => {
    if (hydrated) save(state)
  }, [state, hydrated])

  // The tab title is the signal that works when you are not looking at the
  // page -- which, during a study session, is most of the time.
  // Re-asserted every second, because Next sets the title from route metadata
  // after hydration and would otherwise take it back.
  useEffect(() => {
    if (!hydrated) return
    document.title = tabTitle(state, BASE_TITLE, now)
  }, [state, now, hydrated])

  useEffect(
    () => () => {
      document.title = BASE_TITLE
    },
    [],
  )

  const begin = useCallback(
    (phase: "focus" | "break") => setState((s) => start(s, phase)),
    [],
  )
  const cancel = useCallback(() => setState((s) => stop(s)), [])

  if (!hydrated) return null

  const running = state.phase === "focus" || state.phase === "break"
  const done = state.phase === "done"

  return (
    <>
      <div className="ml-auto flex items-center gap-2">
        {state.completedToday > 0 && (
          <span
            className="text-fog/60 text-[11px]"
            title={`${state.completedToday} focus session${state.completedToday === 1 ? "" : "s"} finished today`}
          >
            {state.completedToday}/2 today
          </span>
        )}

        <button
          onClick={() => (running ? cancel() : begin("focus"))}
          title={
            running
              ? `${formatRemaining(state, now)} left — click to stop`
              : `Start a ${FOCUS_MINUTES} minute session`
          }
          aria-label={running ? "Stop the timer" : "Start a study session"}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
            running
              ? "bg-accent/15 text-accent hover:bg-accent/25"
              : done
                ? "bg-pass/15 text-pass"
                : "text-fog hover:text-chalk"
          }`}
        >
          <Tomato size={15} />
          {running && (
            <span className="font-mono text-[12px] tabular-nums">
              {remainingMinutes(state, now)}
            </span>
          )}
        </button>
      </div>

      {done && (
        <div className="border-pass/40 bg-pass/10 fixed inset-x-0 top-[49px] z-50 flex items-center gap-3 border-b px-4 py-2.5 text-[13px]">
          <Coffee size={15} className="text-pass shrink-0" />
          <span className="text-chalk">
            {FOCUS_MINUTES} minutes done
            {state.completedToday >= 2
              ? " — that is both sessions for today."
              : ". Stand up, look at something further away than a screen."}
          </span>
          <button
            onClick={() => begin("break")}
            className="bg-pass/15 text-pass hover:bg-pass/25 ml-auto shrink-0 rounded px-2.5 py-1 text-[12px] font-medium transition-colors"
          >
            <Play size={11} className="mr-1 inline" />
            {BREAK_MINUTES} minute break
          </button>
          <button
            onClick={cancel}
            aria-label="Dismiss"
            className="text-fog hover:text-chalk shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}

/** lucide has no tomato, and a pomodoro that is not a tomato is just a timer. */
function Tomato({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 7c4.4 0 8 2.9 8 6.5S16.4 21 12 21s-8-3.9-8-7.5S7.6 7 12 7Z" />
      <path d="M12 7 10 4M12 7l2-3M12 7 8.5 5.5M12 7l3.5-1.5" />
    </svg>
  )
}
