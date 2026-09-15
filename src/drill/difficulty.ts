/**
 * Difficulty, as a filter over the deck.
 *
 * `Card.tier` has been the stored field since the spec ("prompt, model answer,
 * topic IDs, difficulty tier"); this just gives the three levels names and a
 * way to select on them, so a session can be aimed at warm-up definitions or
 * at the handful of cards that actually catch people out.
 *
 * Difficulty is NOT interview importance -- that is `topicWeight`, and the two
 * deliberately do not talk to each other. A tricky card can be a footnote and
 * an easy one can be the thing you are asked first. Difficulty picks what a
 * session feels like; weight picks what the queue puts in front of you.
 */

import type { Card } from "./types"

export type Difficulty = "easy" | "mid" | "tricky"
export type DifficultyFilter = Difficulty | "all"

export const TIER: Record<Difficulty, 1 | 2 | 3> = {
  easy: 1,
  mid: 2,
  tricky: 3,
}

/** Listed the way they are offered: easiest first, then the escape hatch. */
export const DIFFICULTY_FILTERS: [DifficultyFilter, string, string][] = [
  ["easy", "Easy", "Definitions and the fundamentals"],
  ["mid", "Mid", "Mechanisms and trade-offs"],
  ["tricky", "Tricky", "The ones that catch people out"],
  ["all", "All", "The whole deck"],
]

export function difficultyOf(card: Card): Difficulty {
  return card.tier === 3 ? "tricky" : card.tier === 2 ? "mid" : "easy"
}

export function filterByDifficulty(
  cards: Card[],
  filter: DifficultyFilter,
): Card[] {
  if (filter === "all") return cards
  return cards.filter((c) => difficultyOf(c) === filter)
}

/** How many cards each option would give you, for labelling the control. */
export function difficultyCounts(
  cards: Card[],
): Record<DifficultyFilter, number> {
  return {
    easy: filterByDifficulty(cards, "easy").length,
    mid: filterByDifficulty(cards, "mid").length,
    tricky: filterByDifficulty(cards, "tricky").length,
    all: cards.length,
  }
}
