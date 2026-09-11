import type { TopicId } from "~/topics"

/** Self-assessed recall quality, in SM-2 order. */
export type Grade = "again" | "hard" | "good" | "easy"

export type Card = {
  id: string
  /** What you are asked. Phrased to demand an explanation, not a word. */
  prompt: string
  /** The answer you grade yourself against. */
  answer: string
  /**
   * The trade-off conversation rather than the definition -- what a senior
   * engineering manager is expected to add on top of a correct answer. Shown
   * below the model answer on the flip, never used for grading.
   */
  emFraming?: string
  topicIds: TopicId[]
  tier: 1 | 2 | 3
}

/**
 * Per-card scheduling state. One Firestore document per card, so it is kept
 * deliberately small and flat.
 */
export type CardState = {
  cardId: string
  easeFactor: number
  intervalDays: number
  repetitions: number
  /** ISO date-time. Due when <= now. */
  dueAt: string
  lapses: number
  lastGrade: Grade | null
  lastReviewedAt: string | null
  /**
   * Set when a failed simulator verdict pushed this card into the deck. Records
   * which scenario earned it, so the review screen can say why you are seeing it.
   */
  enqueuedBy?: { scenarioId: string; ruleId: string; at: string }
}

export type ReviewOutcome = {
  card: Card
  state: CardState
  typedAnswer: string
  grade: Grade
}
