import type { Card } from "../types"
import { consistencyCards } from "./consistency"
import { reliabilityCards } from "./reliability"
import { messagingCards } from "./messaging"
import { scalingCachingCards } from "./scaling-caching"
import { dataAndCostCards } from "./data-and-cost"

/**
 * The deck.
 *
 * One module per rough domain grouping rather than one giant array, because the
 * stated reason for keeping content in the repo was that a card should be
 * reviewable in a pull request -- and a 200-entry array produces diffs nobody
 * reads. Adding a card is an edit to one small file.
 */
export const ALL_CARDS: Card[] = [
  ...consistencyCards,
  ...reliabilityCards,
  ...messagingCards,
  ...scalingCachingCards,
  ...dataAndCostCards,
]

const seen = new Set<string>()
for (const card of ALL_CARDS) {
  if (seen.has(card.id)) throw new Error(`Duplicate card id: ${card.id}`)
  seen.add(card.id)
}

export const CARDS_BY_TOPIC = ALL_CARDS.reduce<Record<string, Card[]>>(
  (acc, card) => {
    for (const t of card.topicIds) (acc[t] ??= []).push(card)
    return acc
  },
  {},
)
