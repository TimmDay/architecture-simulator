/**
 * A study timer.
 *
 * A running phase is driven by an absolute end timestamp rather than by
 * counting ticks. `setInterval` drifts, and browsers throttle timers in
 * background tabs -- which is exactly where a 25 minute timer spends most of
 * its life -- so counting down by subtracting elapsed ticks loses minutes.
 * From an end time, a throttled tab is simply one that redraws less often, and
 * the remaining time is right whenever anyone looks at it.
 *
 * A paused phase is the one exception: it holds a duration instead, because a
 * pause has no end until you resume it. Resuming converts that duration back
 * into a fresh end timestamp, so the throttling argument above still covers
 * every moment the clock is actually moving.
 */

export const FOCUS_MINUTES = 25
export const BREAK_MINUTES = 5

export type Phase = "idle" | "focus" | "break" | "done"

export type TimerState = {
  phase: Phase
  /** Epoch ms when the current phase ends. Null while idle or paused. */
  endsAt: number | null
  /** Milliseconds left at the moment of pausing. Null whenever running. */
  pausedMs: number | null
  /**
   * Focus sessions finished, keyed by day.
   *
   * A running total plus "which day it counts for" needed an explicit rollover
   * step, and a goal spanning a fortnight cannot be built on a number that
   * forgets yesterday. A map keyed by date rolls over on its own, because the
   * key for a new day simply is not there yet.
   */
  history: Record<string, number>
}

export const IDLE: TimerState = {
  phase: "idle",
  endsAt: null,
  pausedMs: null,
  history: {},
}

export function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Whether a phase is underway at all, paused or not. */
export function isActive(state: TimerState): boolean {
  return state.phase === "focus" || state.phase === "break"
}

export function isPaused(state: TimerState): boolean {
  return isActive(state) && state.pausedMs !== null
}

/** Focus sessions finished on a given day. */
export function completedOn(state: TimerState, key: string): number {
  return state.history[key] ?? 0
}

export function completedToday(state: TimerState, now = Date.now()): number {
  return completedOn(state, dayKey(new Date(now)))
}

export function start(
  state: TimerState,
  phase: "focus" | "break",
  now = Date.now(),
): TimerState {
  const minutes = phase === "focus" ? FOCUS_MINUTES : BREAK_MINUTES
  return { ...state, phase, endsAt: now + minutes * 60_000, pausedMs: null }
}

export function stop(state: TimerState): TimerState {
  return { ...state, phase: "idle", endsAt: null, pausedMs: null }
}

export function pause(state: TimerState, now = Date.now()): TimerState {
  if (!isActive(state) || state.pausedMs !== null) return state
  return { ...state, endsAt: null, pausedMs: remainingMs(state, now) }
}

/** Resume from a held duration, turning it back into an end timestamp. */
export function resume(state: TimerState, now = Date.now()): TimerState {
  if (!isActive(state) || state.pausedMs === null) return state
  return { ...state, endsAt: now + state.pausedMs, pausedMs: null }
}

export function togglePause(state: TimerState, now = Date.now()): TimerState {
  return isPaused(state) ? resume(state, now) : pause(state, now)
}

/** Milliseconds left, floored at zero. */
export function remainingMs(state: TimerState, now = Date.now()): number {
  if (state.pausedMs !== null) return Math.max(0, state.pausedMs)
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
 * stopped working. A paused phase never finishes here -- its clock is not
 * running, and counting a session the user did not sit through would be worse
 * than useless in a tool whose whole job is honest self-assessment.
 */
export function tick(state: TimerState, now = Date.now()): TimerState {
  if (state.phase === "idle" || state.phase === "done") return state
  if (state.pausedMs !== null) return state
  if (remainingMs(state, now) > 0) return state

  if (state.phase === "focus") {
    const today = dayKey(new Date(now))
    return {
      ...state,
      phase: "done",
      endsAt: null,
      pausedMs: null,
      history: { ...state.history, [today]: completedOn(state, today) + 1 },
    }
  }
  return { ...state, phase: "idle", endsAt: null, pausedMs: null }
}

/** What the tab should say, so a backgrounded timer is still visible. */
export function tabTitle(
  state: TimerState,
  base: string,
  now = Date.now(),
): string {
  if (state.phase === "done") return `Break time — ${base}`
  if (state.phase === "idle") return base
  const time = formatRemaining(state, now)
  if (isPaused(state)) return `Paused ${time} — ${base}`
  const label = state.phase === "focus" ? "" : "Break "
  return `${label}${time} — ${base}`
}
