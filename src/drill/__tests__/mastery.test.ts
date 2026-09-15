import { describe, expect, it } from "vitest"
import { CORE_CARDS } from "../cards"
import {
  MASTERED_DAYS,
  masteryByDomain,
  masteryOf,
  masteryTotals,
} from "../mastery"
import { newCardState, schedule } from "../sm2"
import { recordSpeedAnswer } from "../speed"
import type { Card, CardState } from "../types"

const card = (id: string, topic: "consistency.cap" | "caching.cdn"): Card => ({
  id,
  prompt: id,
  answer: id,
  topicIds: [topic],
  tier: 1,
  speed: [],
})

describe("what counts as learned", () => {
  it("treats a card never graded as new", () => {
    expect(masteryOf(undefined)).toBe("new")
    expect(masteryOf(newCardState("x"))).toBe("new")
  })

  it("does not promote a card on a correct Speed answer", () => {
    // Recognising an answer among four is not evidence you can produce it.
    const seen = recordSpeedAnswer(newCardState("x"), true)
    expect(masteryOf(seen)).toBe("new")
  })

  it("still counts a card you have seen and failed", () => {
    // `again` resets repetitions to 0, so anything keying on repetitions would
    // report the card you most need to revisit as never studied.
    const failed = schedule(schedule(newCardState("x"), "good"), "again")
    expect(failed.repetitions).toBe(0)
    expect(masteryOf(failed)).toBe("learning")
  })

  it("calls a card mastered once its interval clears the threshold", () => {
    const state: CardState = {
      ...newCardState("x"),
      intervalDays: MASTERED_DAYS,
      lastReviewedAt: new Date().toISOString(),
    }
    expect(masteryOf(state)).toBe("mastered")
    expect(masteryOf({ ...state, intervalDays: MASTERED_DAYS - 1 })).toBe(
      "learning",
    )
  })
})

describe("per-domain counts", () => {
  it("counts each card once, under its primary topic", () => {
    // The old strength grid added a card to every topic it mentioned, so
    // totals never matched the size of the deck.
    const multi: Card = {
      ...card("multi", "consistency.cap"),
      topicIds: ["consistency.cap", "caching.cdn"],
    }
    const rows = masteryByDomain([multi], new Map())
    expect(masteryTotals(rows).cards).toBe(1)
  })

  it("splits a domain three ways and the parts sum to the whole", () => {
    const states = new Map<string, CardState>([
      ["a", newCardState("a")],
      ["b", schedule(newCardState("b"), "good")],
      [
        "c",
        {
          ...newCardState("c"),
          intervalDays: 40,
          lastReviewedAt: new Date().toISOString(),
        },
      ],
    ])
    const rows = masteryByDomain(
      [
        card("a", "consistency.cap"),
        card("b", "consistency.cap"),
        card("c", "consistency.cap"),
      ],
      states,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      cards: 3,
      new: 1,
      learning: 1,
      mastered: 1,
    })
  })

  it("accounts for every card in the real deck", () => {
    const rows = masteryByDomain(CORE_CARDS, new Map())
    const t = masteryTotals(rows)
    expect(t.cards).toBe(CORE_CARDS.length)
    expect(t.new).toBe(CORE_CARDS.length)
    expect(t.new + t.learning + t.mastered).toBe(t.cards)
  })

  it("puts the weakest domain first", () => {
    const states = new Map<string, CardState>([
      [
        "a",
        {
          ...newCardState("a"),
          intervalDays: 40,
          lastReviewedAt: new Date().toISOString(),
        },
      ],
    ])
    const rows = masteryByDomain(
      [card("a", "consistency.cap"), card("b", "caching.cdn")],
      states,
    )
    expect(rows[0]?.mastered).toBe(0)
  })
})
