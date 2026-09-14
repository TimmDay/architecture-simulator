import { describe, expect, it } from "vitest"
import { ALL_CARDS } from "../cards"
import {
  EMPTY_STATS,
  optionsFor,
  recordSpeedAnswer,
  tallySpeed,
} from "../speed"
import { isDue, newCardState, schedule } from "../sm2"

describe("speed variants", () => {
  it("exist for every card, with four distinct options", () => {
    for (const c of ALL_CARDS) {
      const opts = optionsFor(c)
      expect(opts, `${c.id}`).toHaveLength(4)
      expect(
        new Set(opts.map((o) => o.text)).size,
        `${c.id} repeats an option`,
      ).toBe(4)
      for (const o of opts) {
        expect(
          o.text.trim().length,
          `${c.id} has an empty option`,
        ).toBeGreaterThan(3)
      }
    }
  })

  it("has exactly one correct option per card", () => {
    for (const c of ALL_CARDS) {
      expect(optionsFor(c).filter((o) => o.correct)).toHaveLength(1)
    }
  })

  it("keeps options short enough to scan", () => {
    // Four paragraphs is a reading test, not a recall drill.
    for (const c of ALL_CARDS) {
      for (const o of optionsFor(c)) {
        expect(
          o.text.length,
          `${c.id}: "${o.text.slice(0, 40)}..." is too long`,
        ).toBeLessThan(140)
      }
    }
  })

  it("orders options deterministically, so a re-render cannot move them", () => {
    for (const c of ALL_CARDS.slice(0, 20)) {
      expect(optionsFor(c).map((o) => o.text)).toEqual(
        optionsFor(c).map((o) => o.text),
      )
    }
  })

  it("does not always put the correct answer in the same slot", () => {
    const positions = ALL_CARDS.map((c) =>
      optionsFor(c).findIndex((o) => o.correct),
    )
    for (const slot of [0, 1, 2, 3]) {
      expect(
        positions.filter((p) => p === slot).length,
        `no correct answer ever lands in slot ${slot}`,
      ).toBeGreaterThan(0)
    }
    // And no single slot dominates.
    const commonest = Math.max(
      ...[0, 1, 2, 3].map((s) => positions.filter((p) => p === s).length),
    )
    expect(commonest).toBeLessThan(ALL_CARDS.length * 0.45)
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
    expect(recordSpeedAnswer(before, true)).toEqual(before)
  })

  it("pulls the card forward when you get it wrong", () => {
    const before = learned()
    const now = new Date("2026-01-10T09:00:00Z")
    expect(isDue(before, now)).toBe(false)
    const after = recordSpeedAnswer(before, false, now)
    expect(isDue(after, now)).toBe(true)
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

describe("session tally", () => {
  it("tracks accuracy and the best streak", () => {
    let s = EMPTY_STATS
    // streaks run 1, 2, 0, 1, 2, 3 -- so three at the end, and the best is 3.
    for (const ok of [true, true, false, true, true, true])
      s = tallySpeed(s, ok)
    expect(s).toEqual({ answered: 6, right: 5, streak: 3, best: 3 })
  })
})
