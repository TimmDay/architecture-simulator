import type { TopicId } from "~/topics"

/** Self-assessed recall quality, in SM-2 order. */
export type Grade = "again" | "hard" | "good" | "easy"

/**
 * Which deck a card belongs to.
 *
 * `core` cards are the ones worth writing a paragraph about -- mechanisms,
 * trade-offs, the things an interviewer will push on. They appear in both modes.
 *
 * `vocabulary` cards are one-line definitions of the terms themselves. They
 * exist so the language stops costing you effort: you should not be working out
 * what "quorum" means while also reasoning about whether you need one. They are
 * Speed-only on purpose -- typing out "all reads see the latest write" and then
 * grading yourself on it is ceremony, and it would clog the review queue that
 * the harder cards depend on.
 */
export type Deck = "core" | "vocabulary"

export type Card = {
  id: string
  /** Defaults to "core" where a module does not say otherwise. */
  deck?: Deck
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
   *
   * A list, because a Discuss answer often carries several separable claims and
   * one multiple-choice question can only probe one of them. Most cards keep a
   * single variant; the ones whose answer genuinely contains three independent
   * facts get three. Padding a single-fact card out to hit a quota produces
   * filler, so the count follows the material rather than a rule.
   */
  speed: SpeedVariant[]
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
