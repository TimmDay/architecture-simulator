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
  /**
   * The multiple-choice variant, for Speed mode.
   *
   * Deliberately NOT the prose answer above with three others beside it. Four
   * paragraphs is a reading-comprehension test, not a recall drill, so the
   * speed variant asks a tighter question with one-line options.
   *
   * Every distractor should be a mistake somebody actually makes -- a real
   * misconception, a neighbouring concept, or the thing that is true of a
   * different level or mode. Options nobody would pick teach nothing and make
   * the right answer findable by elimination.
   */
  speed: SpeedVariant
}

export type SpeedVariant = {
  /** Overrides the card's prompt when it needs to be sharper for one line. */
  question?: string
  correct: string
  /** Exactly three, each wrong for a different reason. */
  distractors: [string, string, string]
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
