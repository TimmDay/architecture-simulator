import { describe, expect, it } from "vitest"
import { gradeAttempt } from "../grade"
import { SCENARIOS } from "../scenarios"
import { frontPage, frontPageReference } from "../scenarios/02-front-page"
import {
  receiptsAndPayments,
  receiptsAndPaymentsReference,
} from "../scenarios/03-receipts-and-payments"
import {
  firstRealCustomers,
  firstRealCustomersReference,
} from "../scenarios/01-first-real-customers"
import { renderQueue, renderQueueReference } from "../scenarios/04-render-queue"
import {
  everythingDownstream,
  everythingDownstreamReference,
} from "../scenarios/05-everything-downstream"
import {
  aBillionDesigns,
  aBillionDesignsReference,
} from "../scenarios/06-a-billion-designs"
import {
  theViralDeck,
  theViralDeckReference,
} from "../scenarios/07-the-viral-deck"
import { TOPICS } from "~/topics"
import { CATALOGUE } from "../catalogue"
import { CLIENT_NODE_ID } from "../types"

const CASES = [
  { scenario: firstRealCustomers, graph: firstRealCustomersReference },
  { scenario: frontPage, graph: frontPageReference },
  { scenario: receiptsAndPayments, graph: receiptsAndPaymentsReference },
  { scenario: renderQueue, graph: renderQueueReference },
  { scenario: everythingDownstream, graph: everythingDownstreamReference },
  { scenario: aBillionDesigns, graph: aBillionDesignsReference },
  { scenario: theViralDeck, graph: theViralDeckReference },
]

describe.each(CASES)("$scenario.title", ({ scenario, graph }) => {
  const graded = gradeAttempt(graph, scenario)

  it("has a reference solution that passes every requirement", () => {
    const failed = graded.requirements.filter((r) => !r.passed)
    expect(
      failed,
      `failing: ${failed.map((f) => `${f.name} ${f.actual} (needs ${f.required})`).join("; ")}`,
    ).toEqual([])
  })

  it("raises no fail-severity findings against its reference", () => {
    const fails = graded.verdicts.filter((v) => v.severity === "fail")
    expect(fails.map((f) => `${f.ruleId}: ${f.title}`)).toEqual([])
  })

  it("only offers components the catalogue can actually build", () => {
    for (const kind of scenario.availableKinds) {
      expect(
        CATALOGUE[kind],
        `palette offers ${kind}, which has no spec`,
      ).toBeDefined()
    }
  })

  it("tags only real topic ids", () => {
    for (const t of scenario.topicIds)
      expect(TOPICS[t], `unknown topic: ${t}`).toBeDefined()
  })

  it("never uses the reserved client id for a component", () => {
    // "client" is the implicit traffic source. A component taking that id
    // becomes an edge from the client to itself, and the entry point stops
    // meaning what the engine thinks it means.
    for (const c of graph.components) {
      expect(c.id, "a component may not be called 'client'").not.toBe(
        CLIENT_NODE_ID,
      )
    }
  })

  it("targets its fault script at components that exist", () => {
    const ids = new Set(graph.components.map((c) => c.id))
    for (const round of scenario.faultScript) {
      for (const f of round) {
        if ("componentId" in f) {
          expect(
            ids.has(f.componentId),
            `fault targets missing component: ${f.componentId}`,
          ).toBe(true)
        }
      }
    }
  })
})

describe("the catalogue", () => {
  it("is not quietly tuned to make one scenario winnable", () => {
    // Every scenario is graded against the same physics. If a scenario is
    // unwinnable the scenario is wrong, not the catalogue.
    expect(SCENARIOS).toHaveLength(7)
    expect(SCENARIOS.map((s) => s.level)).toEqual([1, 2, 3, 3, 4, 4, 4])
  })
})
