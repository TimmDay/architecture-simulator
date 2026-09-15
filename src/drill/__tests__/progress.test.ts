import { describe, expect, it } from "vitest"
import { ALL_CARDS, CORE_CARDS } from "../cards"
import {
  coverage,
  dueForecast,
  priorities,
  struggling,
  topicStrengths,
} from "../progress"
import { newCardState, schedule } from "../sm2"
import { recordSpeedAnswer } from "../speed"
import type { CardState } from "../types"

const AT = new Date("2026-03-01T09:00:00Z")
const fresh = () =>
  new Map(ALL_CARDS.map((c) => [c.id, newCardState(c.id, AT)]))

describe("coverage", () => {
  it("counts an untouched deck as entirely unseen but entirely due", () => {
    const c = coverage(CORE_CARDS, fresh(), AT)
    expect(c.seen).toBe(0)
    expect(c.solid).toBe(0)
    expect(c.dueNow).toBe(CORE_CARDS.length)
  })

  it("counts a card as solid only once it has held for a week", () => {
    const states = fresh()
    const card = CORE_CARDS[0]!
    let s = schedule(states.get(card.id)!, "good", AT)
    s = schedule(s, "good", new Date("2026-03-02T09:00:00Z"))
    states.set(card.id, s)
    // Two reps, a 6-day interval -- reviewed, not yet dependable.
    expect(
      coverage([card], states, new Date("2026-03-02T10:00:00Z")).solid,
    ).toBe(0)
    states.set(card.id, schedule(s, "good", new Date("2026-03-08T09:00:00Z")))
    expect(
      coverage([card], states, new Date("2026-03-08T10:00:00Z")).solid,
    ).toBe(1)
  })
})

describe("cards that need a tighter recall frequency", () => {
  const repeatedlyForgotten = (): Map<string, CardState> => {
    const states = fresh()
    const card = CORE_CARDS[0]!
    let s = schedule(states.get(card.id)!, "good", AT)
    for (let i = 0; i < 5; i++) {
      s = schedule(s, "again", new Date(AT.getTime() + i * 86_400_000))
      s = schedule(s, "good", new Date(AT.getTime() + (i + 0.5) * 86_400_000))
    }
    states.set(card.id, s)
    return states
  }

  it("surfaces a card forgotten repeatedly, which the queue alone hides", () => {
    // SM-2 shortens the interval quietly, so a card failed six times looks
    // identical in the queue to one never missed. That is what this fixes.
    const found = struggling(CORE_CARDS, repeatedlyForgotten())
    expect(found.length).toBeGreaterThan(0)
    expect(found[0]!.card.id).toBe(CORE_CARDS[0]!.id)
    expect(found[0]!.reason).toContain("forgotten")
  })

  it("says nothing about a deck nobody has studied", () => {
    expect(struggling(CORE_CARDS, fresh())).toEqual([])
  })

  it("counts repeated Speed misses even when Discuss never failed", () => {
    const states = fresh()
    const card = CORE_CARDS[3]!
    let s = schedule(states.get(card.id)!, "good", AT)
    for (let i = 0; i < 5; i++) s = recordSpeedAnswer(s, false, AT)
    states.set(card.id, s)
    const found = struggling([card], states)
    expect(found).toHaveLength(1)
    expect(found[0]!.reason).toContain("Speed")
  })

  it("ranks an interview-critical struggle above an equivalent obscure one", () => {
    const states = fresh()
    const heavy = CORE_CARDS.find((c) => c.topicIds[0] === "consistency.cap")!
    const light = CORE_CARDS.find((c) => c.topicIds[0] === "delivery.iac")!
    for (const card of [heavy, light]) {
      let s = schedule(states.get(card.id)!, "good", AT)
      for (let i = 0; i < 4; i++) s = schedule(s, "again", AT)
      states.set(card.id, s)
    }
    const found = struggling([heavy, light], states)
    expect(found[0]!.card.id).toBe(heavy.id)
  })
})

describe("topic strength", () => {
  it("treats an unstudied topic as weak, not as missing", () => {
    const strengths = topicStrengths(CORE_CARDS, fresh())
    expect(strengths.length).toBeGreaterThan(50)
    expect(strengths.every((t) => t.strength === 0)).toBe(true)
    expect(strengths.every((t) => t.seen === 0)).toBe(true)
  })

  it("does not let a relearned card look as strong as one never forgotten", () => {
    // Interval alone would: it climbs back after relearning while ease, the
    // honest record of difficulty, stays low.
    const easy = schedule(
      schedule(schedule(newCardState("a", AT), "good", AT), "good", AT),
      "good",
      AT,
    )
    let hard = schedule(newCardState("b", AT), "good", AT)
    for (let i = 0; i < 4; i++) hard = schedule(hard, "again", AT)
    hard = schedule(schedule(hard, "good", AT), "good", AT)

    const card = CORE_CARDS[0]!
    const strengthOf = (s: CardState) =>
      topicStrengths(
        [card],
        new Map([[card.id, { ...s, cardId: card.id }]]),
      )[0]!.strength
    expect(strengthOf(easy)).toBeGreaterThan(strengthOf(hard))
  })
})

describe("what to study next", () => {
  it("ranks weak and frequently-asked above weak and obscure", () => {
    const ranked = priorities(topicStrengths(CORE_CARDS, fresh()))
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked[0]!.weight).toBe(3)
    // Never suggests a topic nobody asks about.
    expect(ranked.every((t) => t.weight >= 2)).toBe(true)
  })
})

describe("due forecast", () => {
  it("puts an untouched deck nowhere, since nothing has been scheduled", () => {
    expect(dueForecast(CORE_CARDS, fresh(), 14, AT).every((n) => n === 0)).toBe(
      true,
    )
  })

  it("counts overdue cards as due today rather than dropping them", () => {
    const states = fresh()
    const card = CORE_CARDS[0]!
    states.set(card.id, schedule(states.get(card.id)!, "good", AT))
    // Look a fortnight later: the card was due long ago and is work waiting now.
    const later = new Date(AT.getTime() + 20 * 86_400_000)
    expect(dueForecast([card], states, 14, later)[0]).toBe(1)
  })
})
