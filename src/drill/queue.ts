import type { Card, CardState } from "./types"
import { isDue } from "./sm2"
import { topicWeight, type Weight } from "~/topics"

/**
 * How much this card matters in an interview: the highest weight of any topic
 * it teaches.
 *
 * Deliberately NOT a multiplier on review intervals. Spaced repetition already
 * schedules by how well you know a card; if importance also stretched or
 * compressed intervals the two signals would fight, and a card you know cold
 * would keep interrupting because somebody labelled it important -- which is
 * exactly what the algorithm exists to prevent. Importance decides what you
 * SEE when there is a choice, not how memory is modelled.
 */
export function cardWeight(card: Card): Weight {
  // The PRIMARY topic, not the maximum across all of them. Taking the max let
  // one tangentially-mentioned topic promote a whole card, which rated 76% of
  // the deck as interview-critical -- at which point the label said nothing.
  const primary = card.topicIds[0]
  return primary ? topicWeight(primary) : 2
}

/**
 * Queue policy.
 *
 * The failure mode this guards against is coming back after a fortnight away,
 * being shown 180 due cards, and quitting. Caps are per session, and the oldest
 * debt is paid first.
 */
export const QUEUE_POLICY = {
  /** Cards never seen before, introduced per session. */
  newPerSession: 10,
  /** Due reviews per session, oldest-due first. */
  reviewsPerSession: 40,
} as const

export type QueueItem = { card: Card; state: CardState; isNew: boolean }

export function buildQueue(
  cards: Card[],
  states: Map<string, CardState>,
  now = new Date(),
  policy = QUEUE_POLICY,
): QueueItem[] {
  const seen: QueueItem[] = []
  const fresh: QueueItem[] = []

  for (const card of cards) {
    const state = states.get(card.id)
    if (!state) continue
    const item = {
      card,
      state,
      isNew: state.repetitions === 0 && state.lastReviewedAt === null,
    }
    if (item.isNew) fresh.push(item)
    else if (isDue(state, now)) seen.push(item)
  }

  // Cards pushed in by a failed simulator verdict come first -- you just proved
  // you needed them, and the connection is only vivid for so long.
  seen.sort((a, b) => {
    const aEnq = a.state.enqueuedBy ? 0 : 1
    const bEnq = b.state.enqueuedBy ? 0 : 1
    if (aEnq !== bEnq) return aEnq - bEnq
    // Oldest debt first, and where two cards fell due together the one that
    // matters more in an interview goes first -- which only decides order, and
    // only bites when the session cap cuts the queue short.
    const byDue =
      new Date(a.state.dueAt).getTime() - new Date(b.state.dueAt).getTime()
    if (Math.abs(byDue) > 60_000) return byDue
    return cardWeight(b.card) - cardWeight(a.card)
  })

  // New cards are introduced in importance order, so a short session spends its
  // introductions on what an interviewer is most likely to ask.
  fresh.sort((a, b) => cardWeight(b.card) - cardWeight(a.card))

  const reviews = seen.slice(0, policy.reviewsPerSession)
  const introductions = fresh.slice(0, policy.newPerSession)

  // Interleave rather than front-loading all the reviews: a session that opens
  // with 40 hard recalls feels like a punishment.
  const out: QueueItem[] = []
  const ratio =
    introductions.length > 0
      ? Math.ceil(reviews.length / introductions.length)
      : Infinity
  let n = 0
  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i]
    if (r) out.push(r)
    if ((i + 1) % ratio === 0 && n < introductions.length) {
      const item = introductions[n++]
      if (item) out.push(item)
    }
  }
  while (n < introductions.length) {
    const item = introductions[n++]
    if (item) out.push(item)
  }
  return out
}

/** Per-topic strength, 0-1, for the mastery grid. */
export function topicStrength(cards: Card[], states: Map<string, CardState>) {
  const acc = new Map<string, { total: number; strength: number }>()
  for (const card of cards) {
    const state = states.get(card.id)
    // A card never reviewed contributes 0 strength but still counts to the total,
    // so an untouched domain reads as weak rather than as absent.
    const s =
      !state || state.repetitions === 0
        ? 0
        : Math.min(1, state.intervalDays / 21)
    for (const t of card.topicIds) {
      const prev = acc.get(t) ?? { total: 0, strength: 0 }
      acc.set(t, { total: prev.total + 1, strength: prev.strength + s })
    }
  }
  return new Map(
    [...acc].map(([k, v]) => [k, v.total === 0 ? 0 : v.strength / v.total]),
  )
}
