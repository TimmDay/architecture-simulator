import { describe, expect, it } from "vitest"
import { ALL_CARDS, CORE_CARDS } from "../cards"
import { buildQueue, cardWeight } from "../queue"
import { newCardState, schedule } from "../sm2"
import { speedItems, weightedOrder } from "../speed"
import { ALL_TOPIC_IDS, topicWeight } from "~/topics"

describe("interview weighting", () => {
  it("rates topics on three levels, with a sensible spread", () => {
    // Three rather than ten on purpose: nobody can honestly distinguish a 7
    // from an 8 across 166 topics, and a finer scale is noise wearing the
    // costume of signal.
    const counts = { 1: 0, 2: 0, 3: 0 }
    for (const t of ALL_TOPIC_IDS) counts[topicWeight(t)]++
    expect(counts[3], "no topics rated as interview-critical").toBeGreaterThan(
      20,
    )
    expect(counts[1], "nothing rated as depth").toBeGreaterThan(10)
    // The middle should still be the bulk -- if most things are critical,
    // nothing is.
    expect(counts[2]).toBeGreaterThan(counts[3])
  })

  it("takes a card's weight from its primary topic, not its heaviest", () => {
    // Taking the max let one tangential topic promote a whole card, which rated
    // three quarters of the deck as critical and made the label meaningless.
    for (const card of ALL_CARDS) {
      expect(cardWeight(card), card.id).toBe(topicWeight(card.topicIds[0]!))
    }
  })

  it("does not rate most of the deck as critical", () => {
    const critical = CORE_CARDS.filter((c) => cardWeight(c) === 3).length
    expect(
      critical / CORE_CARDS.length,
      "if everything is critical, nothing is",
    ).toBeLessThan(0.6)
    expect(critical, "nothing is critical").toBeGreaterThan(20)
  })

  it("introduces the most interview-critical new cards first", () => {
    const states = new Map(ALL_CARDS.map((c) => [c.id, newCardState(c.id)]))
    const queue = buildQueue(CORE_CARDS, states)
    expect(queue.length).toBeGreaterThan(0)
    const weights = queue.map((q) => cardWeight(q.card))
    // The session's introductions should lead with weight 3.
    expect(weights[0]).toBe(3)
  })

  it("never lets weight touch the review schedule", () => {
    // Importance decides what you SEE when there is a choice. If it also moved
    // intervals it would fight the algorithm's model of your memory, and a
    // card you know cold would keep interrupting because somebody labelled it
    // important.
    const heavy = ALL_CARDS.find((c) => cardWeight(c) === 3)!
    const light = ALL_CARDS.find((c) => cardWeight(c) === 1)!
    const at = new Date("2026-01-01T09:00:00Z")
    const a = schedule(newCardState(heavy.id), "good", at)
    const b = schedule(newCardState(light.id), "good", at)
    expect(a.intervalDays).toBe(b.intervalDays)
    expect(a.easeFactor).toBe(b.easeFactor)
    expect(a.dueAt).toBe(b.dueAt)
  })

  it("biases Speed mode toward what interviews ask, without excluding anything", () => {
    const items = speedItems(CORE_CARDS)
    let seed = 7
    const pick = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const order = weightedOrder(items, pick)
    expect(order).toHaveLength(items.length)

    const avgWeight = (slice: typeof order) =>
      slice.reduce((n, i) => n + cardWeight(i.card), 0) / slice.length
    const firstQuarter = order.slice(0, Math.floor(order.length / 4))
    const lastQuarter = order.slice(-Math.floor(order.length / 4))
    expect(avgWeight(firstQuarter)).toBeGreaterThan(avgWeight(lastQuarter))

    // Nothing is excluded -- a deck that only ever shows nine topics stops
    // teaching after a week.
    const lightest = Math.min(...order.map((i) => cardWeight(i.card)))
    expect(
      order.filter((i) => cardWeight(i.card) === lightest).length,
    ).toBeGreaterThan(0)
  })
})
