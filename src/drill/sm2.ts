import type { CardState, Grade } from "./types"

/**
 * SM-2, with the variant pinned down.
 *
 * "SM-2" names a family, and the constants are what decide whether the tool is
 * pleasant or quietly infuriating to use every day. These are the SuperMemo-2
 * defaults with one deliberate change: `again` does not reset the interval to
 * zero-and-start-over, it halves the accumulated interval. Full resets punish a
 * single bad day on a card you have known for months, which teaches you to
 * grade dishonestly to protect your streak -- and dishonest self-grading breaks
 * the only signal this app has.
 */

export const INITIAL_EASE = 2.5
export const MIN_EASE = 1.3

/** Applied to the ease factor, per grade. */
const EASE_DELTA: Record<Grade, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
}

/** How many other cards must pass before an `again` card comes back this session. */
export const REQUEUE_GAP = 3

export function newCardState(cardId: string, now = new Date()): CardState {
  return {
    cardId,
    easeFactor: INITIAL_EASE,
    intervalDays: 0,
    repetitions: 0,
    dueAt: now.toISOString(),
    lapses: 0,
    lastGrade: null,
    lastReviewedAt: null,
  }
}

function addDays(from: Date, days: number): string {
  const d = new Date(from)
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

/** Pure. Given the current state and a grade, produce the next state. */
export function schedule(
  state: CardState,
  grade: Grade,
  now = new Date(),
): CardState {
  const easeFactor = Math.max(MIN_EASE, state.easeFactor + EASE_DELTA[grade])

  let intervalDays: number
  let repetitions: number

  if (grade === "again") {
    // Halve, don't reset. Floor of one day so it comes back tomorrow at worst.
    intervalDays = Math.max(1, Math.round(state.intervalDays / 2))
    repetitions = 0
  } else if (state.repetitions === 0) {
    intervalDays = grade === "easy" ? 3 : 1
    repetitions = 1
  } else if (state.repetitions === 1) {
    intervalDays = grade === "hard" ? 3 : grade === "easy" ? 8 : 6
    repetitions = 2
  } else {
    const multiplier =
      grade === "hard" ? 1.2 : grade === "easy" ? easeFactor * 1.3 : easeFactor
    intervalDays = Math.max(1, Math.round(state.intervalDays * multiplier))
    repetitions = state.repetitions + 1
  }

  return {
    ...state,
    easeFactor,
    intervalDays,
    repetitions,
    dueAt: addDays(now, intervalDays),
    lapses: grade === "again" ? state.lapses + 1 : state.lapses,
    lastGrade: grade,
    lastReviewedAt: now.toISOString(),
    // Once reviewed, the card is an ordinary part of the deck again.
    enqueuedBy: undefined,
  }
}

/**
 * Push a card to the front of the deck because a simulator rule failed.
 *
 * Deliberately does NOT touch easeFactor, repetitions or lapses. Failing to
 * build something is evidence you should see the card again soon; it is not
 * evidence that your recall history on it was wrong, and corrupting the
 * scheduling state would make the feedback loop degrade the deck over time.
 */
export function enqueueFromVerdict(
  state: CardState,
  source: { scenarioId: string; ruleId: string },
  now = new Date(),
): CardState {
  return {
    ...state,
    dueAt: now.toISOString(),
    enqueuedBy: { ...source, at: now.toISOString() },
  }
}

export function isDue(state: CardState, now = new Date()): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime()
}
