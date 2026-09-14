import { describe, expect, it } from "vitest"
import { ALL_CARDS } from "../cards"
import { RULES } from "~/sim/rules"
import { SCENARIOS } from "~/sim/scenarios"
import { ALL_TOPIC_IDS, TOPICS, type TopicId } from "~/topics"

const coveredByCards = new Set(ALL_CARDS.flatMap((c) => c.topicIds))

describe("deck coverage", () => {
  it("gives every card a real topic and a real answer", () => {
    for (const card of ALL_CARDS) {
      expect(card.topicIds.length, `${card.id} has no topics`).toBeGreaterThan(
        0,
      )
      for (const t of card.topicIds)
        expect(TOPICS[t], `${card.id}: unknown topic ${t}`).toBeDefined()
      expect(
        card.answer.length,
        `${card.id} has a stub answer`,
      ).toBeGreaterThan(80)
      expect(card.prompt.length).toBeGreaterThan(20)
    }
  })

  it("covers every topic a scenario claims to teach", () => {
    // A scenario that lists a topic with no card cannot close the loop: fail a
    // rule, and there is nothing to put in the deck.
    const claimed = new Set(SCENARIOS.flatMap((s) => s.topicIds))
    const missing = [...claimed].filter((t) => !coveredByCards.has(t))
    expect(
      missing,
      `scenarios teach topics with no cards: ${missing.join(", ")}`,
    ).toEqual([])
  })

  it("covers every topic a rule can raise", () => {
    // Same requirement from the other direction: a verdict whose topics match
    // no card silently enqueues nothing.
    const raised = new Set<TopicId>()
    for (const rule of RULES) {
      for (const m of rule.check
        .toString()
        .matchAll(/"([a-z-]+\.[a-z0-9-]+)"/g)) {
        const id = m[1] as TopicId
        if (TOPICS[id]) raised.add(id)
      }
    }
    const missing = [...raised].filter((t) => !coveredByCards.has(t))
    expect(
      missing,
      `rules raise topics with no cards: ${missing.join(", ")}`,
    ).toEqual([])
  })

  it("has no orphaned topics outside the long tail", () => {
    // Not every topic needs a card yet, but the gap should be visible rather
    // than silently growing.
    const uncovered = ALL_TOPIC_IDS.filter((t) => !coveredByCards.has(t))
    expect(
      uncovered.length,
      `${uncovered.length} topics still have no card: ${uncovered.join(", ")}`,
    ).toBeLessThan(45)
  })

  it("weights the deck toward what the simulator leans on", () => {
    const count = (prefix: string) =>
      ALL_CARDS.filter((c) => c.topicIds.some((t) => t.startsWith(prefix)))
        .length
    for (const domain of [
      "consistency",
      "transactions",
      "messaging",
      "reliability",
    ]) {
      expect(count(domain), `${domain} is thin`).toBeGreaterThanOrEqual(6)
    }
  })
})
