import type { Card, CardState, SpeedVariant } from "./types"
import { cardWeight } from "./queue"

/**
 * Speed mode: recognise the right answer among four, rather than produce it.
 */

export type Option = { text: string; correct: boolean }

/**
 * One question in Speed mode, and the card it belongs to.
 *
 * A card can carry several, so the session works over these rather than over
 * cards -- otherwise a card with three variants would only ever show its first.
 */
export type SpeedItem = { card: Card; variant: SpeedVariant; index: number }

export function speedItems(cards: Card[]): SpeedItem[] {
  return cards.flatMap((card) =>
    card.speed.map((variant, index) => ({ card, variant, index })),
  )
}

/**
 * Bias a Speed session toward what interviews actually ask.
 *
 * Safe here in a way it would not be in the review queue: Speed does not drive
 * the schedule, so weighting what you see cannot corrupt the algorithm's model
 * of your memory. A weight-3 topic appears about twice as often as a weight-1
 * one -- noticeably more, not to the exclusion of everything else, since a deck
 * that only ever shows you nine topics stops teaching after a week.
 */
export function weightedOrder(
  items: SpeedItem[],
  pick: () => number,
): SpeedItem[] {
  const scored = items.map((item) => ({
    item,
    // Random key raised to a power that falls as weight rises: higher weight
    // tends to sort earlier, without ever fully excluding anything.
    key: Math.pow(pick(), 3 / cardWeight(item.card)),
  }))
  scored.sort((a, b) => b.key - a.key)
  // de-adjacent only: shuffling here would throw away the weighting.
  return deAdjacent(scored.map((s) => s.item))
}

/**
 * Order items so that two questions about the same card never sit next to each
 * other. Asking three facets of CAP in a row is a worse session than spreading
 * them out, and the multi-variant cards are exactly the ones it would happen to.
 */
export function spreadItems(
  items: SpeedItem[],
  pick: () => number,
): SpeedItem[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1)) % (i + 1)
    const a = pool[i]!
    pool[i] = pool[j]!
    pool[j] = a
  }
  return deAdjacent(pool)
}

/**
 * Move questions about the same card apart, preserving the order otherwise.
 *
 * Split out from `spreadItems` because weighted ordering has to survive it.
 * Shuffling after sorting by weight discards the weighting entirely, which is
 * exactly what this used to do.
 */
export function deAdjacent(pool: SpeedItem[]): SpeedItem[] {
  const out: SpeedItem[] = []
  const held: SpeedItem[] = []
  for (const item of pool) {
    if (out.length > 0 && out[out.length - 1]!.card.id === item.card.id)
      held.push(item)
    else out.push(item)
  }
  // Anything held back goes wherever it does not sit beside its sibling.
  for (const item of held) {
    const at = out.findIndex(
      (o, i) =>
        o.card.id !== item.card.id &&
        (out[i + 1]?.card.id ?? null) !== item.card.id,
    )
    if (at === -1) out.push(item)
    else out.splice(at + 1, 0, item)
  }
  return out
}

/**
 * Order the four options deterministically from the card id.
 *
 * Deterministic because a re-render must not reshuffle the answers under the
 * cursor, and because a test that cannot predict the order cannot check that
 * the correct answer is not always in the same position.
 */
export function optionsFor(item: SpeedItem): Option[] {
  const options: Option[] = [
    { text: item.variant.correct, correct: true },
    ...item.variant.distractors.map((text) => ({ text, correct: false })),
  ]
  // xorshift seeded from the card id AND the variant index, so two questions
  // about the same card do not put their answer in the same slot.
  let seed = 2166136261
  for (const ch of `${item.card.id}:${item.index}`) {
    seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619)
  }
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
