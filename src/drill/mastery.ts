/**
 * How much of the deck you have actually learned.
 *
 * Three buckets rather than a percentage, because a single number hides the
 * distinction that matters: a domain at 40% could be half-mastered or entirely
 * half-known, and those call for completely different sessions.
 *
 * A card counts as touched only once it has been GRADED in Discuss --
 * `lastReviewedAt` is set by `schedule` and by nothing else. Getting a Speed
 * question right deliberately does not count: recognising an answer among four
 * is not evidence you can produce it, and letting it promote cards here would
 * report mastery you do not have.
 *
 * `lastReviewedAt` is also the reason this does not test `repetitions`. Grading
 * "again" resets repetitions to zero, so a card you have seen and failed --
 * precisely the card you most need to see reported -- would otherwise come back
 * as never studied.
 */

import { DOMAINS, TOPICS, type DomainId } from "~/topics"
import type { Card, CardState } from "./types"

/** The interval at which a card stops needing regular attention. */
export const MASTERED_DAYS = 21

export type MasteryLevel = "new" | "learning" | "mastered"

export function masteryOf(state: CardState | undefined): MasteryLevel {
  if (!state || state.lastReviewedAt === null) return "new"
  return state.intervalDays >= MASTERED_DAYS ? "mastered" : "learning"
}

export type DomainStats = {
  domain: DomainId
  label: string
  cards: number
  new: number
  learning: number
  mastered: number
}

/**
 * Per-domain counts.
 *
 * A card is counted once, under its PRIMARY topic. The old strength grid added
 * a card to every topic it mentioned, so a card touching three topics counted
 * three times and the totals never matched the deck.
 */
export function masteryByDomain(
  cards: Card[],
  states: Map<string, CardState>,
): DomainStats[] {
  const acc = new Map<DomainId, DomainStats>()

  for (const card of cards) {
    const primary = card.topicIds[0]
    if (!primary) continue
    const domain = TOPICS[primary].domain
    const row = acc.get(domain) ?? {
      domain,
      label: DOMAINS[domain],
      cards: 0,
      new: 0,
      learning: 0,
      mastered: 0,
    }
    row.cards += 1
    row[masteryOf(states.get(card.id))] += 1
    acc.set(domain, row)
  }

  // Weakest first: the point of the panel is to show where to go next.
  return [...acc.values()].sort(
    (a, b) => a.mastered / a.cards - b.mastered / b.cards,
  )
}

export function masteryTotals(rows: DomainStats[]) {
  return rows.reduce(
    (t, r) => ({
      cards: t.cards + r.cards,
      new: t.new + r.new,
      learning: t.learning + r.learning,
      mastered: t.mastered + r.mastered,
    }),
    { cards: 0, new: 0, learning: 0, mastered: 0 },
  )
}
