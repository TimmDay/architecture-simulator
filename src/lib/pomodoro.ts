/**
 * A study timer.
 *
 * Everything here is pure and driven by an absolute end timestamp rather than
 * by counting ticks. `setInterval` drifts, and browsers throttle timers in
 * background tabs -- which is exactly where a 25 minute timer spends most of
 * its life -- so counting down by subtracting elapsed ticks loses minutes.
 * From an end time, a throttled tab is simply one that redraws less often, and
 * the remaining time is right whenever anyone looks at it.
 */

export const FOCUS_MINUTES = 25
export const BREAK_MINUTES = 5

export type Phase = "idle" | "focus" | "break" | "done"

export type TimerState = {
  phase: Phase
  /** Epoch ms when the current phase ends. Null while idle. */
  endsAt: number | null
  /** Focus sessions finished today, to match a two-a-day routine. */
  completedToday: number
  /** Which day `completedToday` counts, so it resets on its own. */
  countedOn: string
}

export const IDLE: TimerState = {
  phase: "idle",
  endsAt: null,
  completedToday: 0,
  countedOn: "",
}

export function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function start(
  state: TimerState,
  phase: "focus" | "break",
  now = Date.now(),
): TimerState {
  const minutes = phase === "focus" ? FOCUS_MINUTES : BREAK_MINUTES
  return { ...state, phase, endsAt: now + minutes * 60_000 }
}

export function stop(state: TimerState): TimerState {
  return { ...state, phase: "idle", endsAt: null }
}

/** Milliseconds left, floored at zero. */
export function remainingMs(state: TimerState, now = Date.now()): number {
  if (state.endsAt === null) return 0
  return Math.max(0, state.endsAt - now)
}

/**
 * Minutes remaining, rounded UP.
 *
 * A timer showing 0 for the last fifty-nine seconds reads as broken, so the
 * final minute shows 1 and the display reaches 0 only when the phase is over.
 */
export function remainingMinutes(state: TimerState, now = Date.now()): number {
  return Math.ceil(remainingMs(state, now) / 60_000)
}

export function formatRemaining(state: TimerState, now = Date.now()): string {
  const total = Math.ceil(remainingMs(state, now) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Advance the state for the current moment.
 *
 * A finished focus phase becomes `done` and counts towards today; a finished
 * break returns quietly to idle, because nobody needs congratulating for having
 * stopped working.
 */
export function tick(state: TimerState, now = Date.now()): TimerState {
  const today = dayKey(new Date(now))
  const rolled =
    state.countedOn === today
      ? state
      : { ...state, completedToday: 0, countedOn: today }

  if (rolled.phase === "idle" || rolled.phase === "done") return rolled
  if (remainingMs(rolled, now) > 0) return rolled

  if (rolled.phase === "focus") {
    return {
      ...rolled,
      phase: "done",
      endsAt: null,
      completedToday: rolled.completedToday + 1,
      countedOn: today,
    }
  }
  return { ...rolled, phase: "idle", endsAt: null }
}

/** What the tab should say, so a backgrounded timer is still visible. */
export function tabTitle(
  state: TimerState,
  base: string,
  now = Date.now(),
): string {
  if (state.phase === "done") return `Break time — ${base}`
  if (state.phase === "idle") return base
  const label = state.phase === "focus" ? "" : "Break "
  return `${label}${formatRemaining(state, now)} — ${base}`
}
