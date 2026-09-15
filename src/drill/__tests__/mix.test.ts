import { describe, expect, it } from "vitest"
import {
  MIX_RATIO,
  afterDiscuss,
  afterSpeed,
  isDiscussDue,
  nextGap,
  startMix,
} from "../mix"

/** A stub RNG, so the ratio is asserted rather than sampled. */
const rng = (...values: number[]) => {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]!
}

describe("the mix ratio", () => {
  it("draws gaps of 4, 5 or 6", () => {
    expect(nextGap(rng(0))).toBe(4)
    expect(nextGap(rng(0.5))).toBe(5)
    expect(nextGap(rng(0.999))).toBe(6)
  })

  it("averages exactly one Discuss card per five Speed questions", () => {
    const support = [nextGap(rng(0)), nextGap(rng(0.5)), nextGap(rng(0.999))]
    expect(support.reduce((a, b) => a + b, 0) / support.length).toBe(MIX_RATIO)
  })

  it("never deals two Discuss cards in a row", () => {
    // The reason for a gap rather than a per-question coin flip: a flat 1-in-6
    // can put two together, which is not what "one in five" should feel like.
    expect(Math.min(nextGap(rng(0)), nextGap(rng(0.999)))).toBeGreaterThan(1)
  })
})

describe("running a mix session", () => {
  it("holds off until the gap is filled", () => {
    let s = startMix(rng(0.5)) // gap of 5
    for (let i = 0; i < 4; i++) {
      s = afterSpeed(s)
      expect(isDiscussDue(s)).toBe(false)
    }
    s = afterSpeed(s)
    expect(isDiscussDue(s)).toBe(true)
  })

  it("only counts questions that were answered", () => {
    // Skipping past four questions must not earn a Discuss card.
    const s = startMix(rng(0.5))
    expect(isDiscussDue(s)).toBe(false)
    expect(s.answered).toBe(0)
  })

  it("resets and re-draws after a Discuss card", () => {
    let s = startMix(rng(0))
    for (let i = 0; i < 4; i++) s = afterSpeed(s)
    expect(isDiscussDue(s)).toBe(true)
    s = afterDiscuss(s, rng(0.999))
    expect(isDiscussDue(s)).toBe(false)
    expect(s).toEqual({ answered: 0, gap: 6 })
  })
})
