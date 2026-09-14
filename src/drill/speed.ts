import type { Card, CardState } from "./types"

/**
 * Speed mode: recognise the right answer among four, rather than produce it.
 */

export type Option = { text: string; correct: boolean }

/**
 * Order the four options deterministically from the card id.
 *
 * Deterministic because a re-render must not reshuffle the answers under the
 * cursor, and because a test that cannot predict the order cannot check that
 * the correct answer is not always in the same position.
 */
export function optionsFor(card: Card, salt = 0): Option[] {
  const options: Option[] = [
    { text: card.speed.correct, correct: true },
    ...card.speed.distractors.map((text) => ({ text, correct: false })),
  ]
  // xorshift seeded from the card id: same card, same order, every time.
  let seed = salt + 2166136261
  for (const ch of card.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619)
  const rand = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return Math.abs(seed) / 2147483647
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % (i + 1)
    const a = options[i]!
    const b = options[j]!
    options[i] = b
    options[j] = a
  }
  return options
}

/**
 * What a speed answer does to the card's schedule.
 *
 * Asymmetric on purpose. Recognising an answer among four is weaker evidence
 * than producing one from nothing, so a correct pick does NOT push the interval
 * out -- doing that would let a fast session inflate every interval in the deck
 * and hollow it out, and you would discover the damage weeks later with no way
 * to tell which cards you actually knew.
 *
 * A wrong pick is different. Failing to recognise the answer with it in front of
 * you is strong evidence, so the card comes back tomorrow. Ease and repetitions
 * are left alone either way: Discuss mode owns the schedule, and this only ever
 * pulls a card forward.
 */
export function recordSpeedAnswer(
  state: CardState,
  correct: boolean,
  now = new Date(),
): CardState {
  if (correct) return state
  return {
    ...state,
    dueAt: now.toISOString(),
    intervalDays: Math.min(state.intervalDays, 1),
  }
}

export type SpeedStats = {
  answered: number
  right: number
  streak: number
  best: number
}

export const EMPTY_STATS: SpeedStats = {
  answered: 0,
  right: 0,
  streak: 0,
  best: 0,
}

export function tallySpeed(stats: SpeedStats, correct: boolean): SpeedStats {
  const streak = correct ? stats.streak + 1 : 0
  return {
    answered: stats.answered + 1,
    right: stats.right + (correct ? 1 : 0),
    streak,
    best: Math.max(stats.best, streak),
  }
}
