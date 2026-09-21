import { describe, expect, it } from "vitest"
import { ALL_CARDS } from "../cards"
import {
  EMPTY_STATS,
  optionsFor,
  pullForward,
  recordSpeedAnswer,
  speedItems,
  spreadItems,
  tallySpeed,
} from "../speed"
import { isDue, newCardState, schedule } from "../sm2"

const ITEMS = speedItems(ALL_CARDS)
const label = (i: (typeof ITEMS)[number]) => `${i.card.id}[${i.index}]`

describe("speed variants", () => {
  it("give every card at least one, with four distinct options", () => {
    for (const card of ALL_CARDS) {
      expect(
        card.speed.length,
        `${card.id} has no speed variant`,
      ).toBeGreaterThan(0)
    }
    for (const item of ITEMS) {
      const opts = optionsFor(item)
      expect(opts, label(item)).toHaveLength(4)
      expect(
        new Set(opts.map((o) => o.text)).size,
        `${label(item)} repeats an option`,
      ).toBe(4)
      for (const o of opts) {
        expect(
          o.text.trim().length,
          `${label(item)} has an empty option`,
        ).toBeGreaterThan(3)
      }
    }
  })

  it("has exactly one correct option each", () => {
    for (const item of ITEMS) {
      expect(
        optionsFor(item).filter((o) => o.correct),
        label(item),
      ).toHaveLength(1)
    }
  })

  it("keeps options short enough to scan", () => {
    // Four paragraphs is a reading test, not a recall drill.
    for (const item of ITEMS) {
      for (const o of optionsFor(item)) {
        expect(
          o.text.length,
          `${label(item)}: "${o.text.slice(0, 40)}..." is too long`,
        ).toBeLessThan(140)
      }
    }
  })

  it("never asks the same question twice on one card", () => {
    for (const card of ALL_CARDS) {
      const asked = card.speed.map((v) => v.question ?? card.prompt)
      expect(new Set(asked).size, `${card.id} repeats a question`).toBe(
        asked.length,
      )
      const answers = card.speed.map((v) => v.correct)
      expect(new Set(answers).size, `${card.id} repeats an answer`).toBe(
        answers.length,
      )
    }
  })

  it("orders options deterministically, so a re-render cannot move them", () => {
    for (const item of ITEMS.slice(0, 30)) {
      expect(optionsFor(item).map((o) => o.text)).toEqual(
        optionsFor(item).map((o) => o.text),
      )
    }
  })

  it("varies answer position between a card's own variants", () => {
    // Seeded from the card id AND the variant index, so a multi-variant card
    // cannot teach its own answer position. Asserted across the set rather than
    // per card: with four slots, two independent shuffles landing on the same
    // one is a coin flip, and demanding they always differ would be demanding
    // that the shuffle is not random.
    const multi = ALL_CARDS.filter((c) => c.speed.length > 1)
    expect(multi.length, "no card has more than one variant").toBeGreaterThan(5)
    const varied = multi.filter((card) => {
      const slots = card.speed.map((variant, index) =>
        optionsFor({ card, variant, index }).findIndex((o) => o.correct),
      )
      return new Set(slots).size > 1
    })
    expect(varied.length / multi.length).toBeGreaterThan(0.5)
  })

  it("does not cluster the correct answer in one slot across the deck", () => {
    const positions = ITEMS.map((i) =>
      optionsFor(i).findIndex((o) => o.correct),
    )
    for (const slot of [0, 1, 2, 3]) {
      expect(
        positions.filter((p) => p === slot).length,
        `no correct answer ever lands in slot ${slot}`,
      ).toBeGreaterThan(0)
    }
    const commonest = Math.max(
      ...[0, 1, 2, 3].map((s) => positions.filter((p) => p === s).length),
    )
    expect(commonest).toBeLessThan(ITEMS.length * 0.45)
  })
})

describe("ordering a session", () => {
  it("never puts two questions about the same card back to back", () => {
    // Asking three facets of CAP in a row is a worse session than spreading
    // them out, and multi-variant cards are exactly where it would happen.
    let seed = 1
    const pick = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let run = 0; run < 5; run++) {
      const order = spreadItems(ITEMS, pick)
      expect(order).toHaveLength(ITEMS.length)
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i]!.card.id === order[i - 1]!.card.id,
          `${order[i]!.card.id} appeared twice in a row`,
        ).toBe(false)
      }
    }
  })

  it("keeps every question exactly once", () => {
    const order = spreadItems(ITEMS, Math.random)
    const keys = order.map((i) => `${i.card.id}:${i.index}`)
    expect(new Set(keys).size).toBe(ITEMS.length)
  })
})

describe("what a speed answer does to the schedule", () => {
  const learned = () => {
    let s = schedule(
      newCardState("c"),
      "good",
      new Date("2026-01-01T09:00:00Z"),
    )
    s = schedule(s, "good", new Date("2026-01-02T09:00:00Z"))
    return schedule(s, "good", new Date("2026-01-08T09:00:00Z"))
  }

  it("leaves the schedule untouched when you get it right", () => {
    // Recognising among four is weaker evidence than producing from nothing.
    // Letting it push intervals out would hollow the deck out invisibly.
    const before = learned()
    const after = recordSpeedAnswer(before, true)
    expect(after.dueAt).toBe(before.dueAt)
    expect(after.intervalDays).toBe(before.intervalDays)
    expect(after.easeFactor).toBe(before.easeFactor)
    expect(after.repetitions).toBe(before.repetitions)
  })

  it("records the attempt either way, so recognition can be measured", () => {
    // Counting only failures would make it impossible to see where recognition
    // is weak -- you would have misses with no denominator.
    const first = recordSpeedAnswer(learned(), true)
    expect(first.speedSeen).toBe(1)
    expect(first.speedRight).toBe(1)
    const second = recordSpeedAnswer(first, false)
    expect(second.speedSeen).toBe(2)
    expect(second.speedRight).toBe(1)
  })

  it("pulls the card forward when you get it wrong", () => {
    const before = learned()
    const now = new Date("2026-01-10T09:00:00Z")
    expect(isDue(before, now)).toBe(false)
    expect(isDue(recordSpeedAnswer(before, false, now), now)).toBe(true)
  })

  it("never damages ease or repetitions -- Discuss mode owns those", () => {
    const before = learned()
    const after = recordSpeedAnswer(
      before,
      false,
      new Date("2026-01-10T09:00:00Z"),
    )
    expect(after.easeFactor).toBe(before.easeFactor)
    expect(after.repetitions).toBe(before.repetitions)
    expect(after.lapses).toBe(before.lapses)
  })
})

describe("flagging a right answer for review", () => {
  const learned = () => {
    let s = schedule(
      newCardState("c"),
      "good",
      new Date("2026-01-01T09:00:00Z"),
    )
    s = schedule(s, "good", new Date("2026-01-02T09:00:00Z"))
    return schedule(s, "good", new Date("2026-01-08T09:00:00Z"))
  }
  const now = new Date("2026-01-10T09:00:00Z")

  it("brings the card back, exactly as a wrong answer would", () => {
    // Same function behind both, so "as expensive as getting it wrong" is a
    // property of the code rather than a claim in a comment.
    const before = learned()
    expect(isDue(before, now)).toBe(false)
    expect(isDue(pullForward(before, now), now)).toBe(true)
  })

  it("caps the interval, so the next grade cannot leap it away again", () => {
    // The part that makes the flag stick. Moving only the due date would buy a
    // single extra look: one "good" on a 30-day card lands it at ~75 days.
    const before = learned()
    expect(before.intervalDays).toBeGreaterThan(1)
    expect(pullForward(before, now).intervalDays).toBe(1)
  })

  it("leaves the answer counted correct rather than recording it twice", () => {
    // The UI flags the state `recordSpeedAnswer` already produced. Running the
    // recording again would show two attempts where the user answered once.
    const counted = recordSpeedAnswer(learned(), true)
    const flagged = pullForward(counted, now)
    expect(flagged.speedSeen).toBe(1)
    expect(flagged.speedRight).toBe(1)
  })

  it("does not touch the memory model -- Discuss still owns that", () => {
    const before = learned()
    const after = pullForward(before, now)
    expect(after.easeFactor).toBe(before.easeFactor)
    expect(after.repetitions).toBe(before.repetitions)
    expect(after.lapses).toBe(before.lapses)
    expect(after.lastReviewedAt).toBe(before.lastReviewedAt)
    // Not `enqueuedBy`: that field means a simulator rule failed, and the
    // review screen renders a scenario name from it.
    expect(after.enqueuedBy).toBeUndefined()
  })
})

describe("session tally", () => {
  it("tracks accuracy and the best streak", () => {
    let s = EMPTY_STATS
    // streaks run 1, 2, 0, 1, 2, 3 -- so three at the end, and the best is 3.
    for (const ok of [true, true, false, true, true, true])
      s = tallySpeed(s, ok)
    expect(s).toEqual({ answered: 6, right: 5, streak: 3, best: 3 })
  })
})
