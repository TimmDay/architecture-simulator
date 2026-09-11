import { describe, expect, it } from "vitest"
import { ALL_CARDS } from "../cards"
import { buildQueue } from "../queue"
import { enqueueFromVerdict, newCardState, schedule } from "../sm2"
import type { CardState } from "../types"
import { gradeAttempt } from "~/sim/grade"
import { firstRealCustomers as scenario } from "~/sim/scenarios/01-first-real-customers"
import type { ArchitectureGraph } from "~/sim/types"
import { CLIENT_NODE_ID } from "~/sim/types"
import { TOPICS } from "~/topics"

/**
 * End-to-end proof of the integration that justifies both modes living in one
 * app: build something bad, and tomorrow's deck knows about it.
 */
const naive: ArchitectureGraph = {
  components: [
    {
      id: "app",
      kind: "app-server",
      label: "Helpdesk app",
      instances: 1,
      region: "eu-west-1",
      config: { availabilityZones: 1, sessionStore: "in-memory" },
    },
    {
      id: "db",
      kind: "sql-primary",
      label: "Tickets database",
      instances: 1,
      region: "eu-west-1",
      config: { availabilityZones: 1 },
    },
  ],
  edges: [
    {
      id: "c-app",
      from: CLIENT_NODE_ID,
      to: "app",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "app-db",
      from: "app",
      to: "db",
      kind: "sync-request",
      carries: "all",
    },
  ],
}

describe("a failed build feeds the deck", () => {
  const graded = gradeAttempt(naive, scenario)

  it("every verdict topic is a real topic id", () => {
    // The whole loop hinges on these matching. A bare `string` TopicId would let
    // a typo here silently break the feature; this asserts the contract holds.
    for (const v of graded.verdicts) {
      for (const t of v.topicIds) {
        expect(TOPICS[t], `unknown topic id: ${t}`).toBeDefined()
      }
    }
  })

  it("failed verdicts resolve to cards that exist", () => {
    const failedTopics = new Set(
      graded.verdicts
        .filter((v) => v.severity === "fail")
        .flatMap((v) => v.topicIds),
    )
    expect(failedTopics.size).toBeGreaterThan(0)
    const matched = ALL_CARDS.filter((c) =>
      c.topicIds.some((t) => failedTopics.has(t)),
    )
    expect(matched.length).toBeGreaterThan(0)
  })

  it("puts those cards at the front of tomorrow's queue", () => {
    const states = new Map<string, CardState>()
    // Everything is freshly reviewed and scheduled well into the future, so
    // nothing would normally be due.
    for (const card of ALL_CARDS) {
      let s = schedule(
        newCardState(card.id),
        "easy",
        new Date("2026-01-01T09:00:00Z"),
      )
      s = schedule(s, "easy", new Date("2026-01-04T09:00:00Z"))
      states.set(card.id, s)
    }
    const tomorrow = new Date("2026-01-05T09:00:00Z")
    expect(buildQueue(ALL_CARDS, states, tomorrow)).toHaveLength(0)

    const failedTopics = new Set(
      graded.verdicts
        .filter((v) => v.severity === "fail")
        .flatMap((v) => v.topicIds),
    )
    for (const card of ALL_CARDS) {
      if (!card.topicIds.some((t) => failedTopics.has(t))) continue
      const base = states.get(card.id)!
      states.set(
        card.id,
        enqueueFromVerdict(
          base,
          { scenarioId: scenario.id, ruleId: "topology.spof" },
          tomorrow,
        ),
      )
    }

    const queue = buildQueue(ALL_CARDS, states, tomorrow)
    expect(queue.length).toBeGreaterThan(0)
    // And they lead, because the connection is only vivid for so long.
    expect(queue[0]?.state.enqueuedBy).toBeDefined()
  })
})
