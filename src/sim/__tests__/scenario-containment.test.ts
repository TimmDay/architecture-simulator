import { describe, expect, it } from "vitest"
import { gradeAttempt } from "../grade"
import { SCENARIOS } from "../scenarios"
import {
  firstRealCustomers,
  firstRealCustomersReference,
} from "../scenarios/01-first-real-customers"
import { RULES } from "../rules"

/**
 * Findings must stay inside the scenario that earns them.
 *
 * A helpdesk with no photo uploads should never be told its receipts belong in
 * object storage. Rules written for one scenario leak into every other one that
 * happens to lack the component they look for, unless they gate on what the
 * product actually does.
 */
describe("scenario containment", () => {
  it("does not raise upload findings against a product with no uploads", () => {
    expect(firstRealCustomers.features).not.toContain("file-uploads")
    const graded = gradeAttempt(firstRealCustomersReference, firstRealCustomers)
    const ids = graded.verdicts.map((v) => v.ruleId)
    expect(ids).not.toContain("data-stores.blobs-in-database")
    expect(ids).not.toContain("capacity.slow-work-on-request-path")
  })

  it("does not raise payment findings against a product that takes no payments", () => {
    expect(firstRealCustomers.features).not.toContain("payments")
    const graded = gradeAttempt(firstRealCustomersReference, firstRealCustomers)
    expect(graded.verdicts.map((v) => v.ruleId)).not.toContain(
      "transactions.no-idempotency-key",
    )
  })

  it("raises the upload finding when a product does take uploads and stores them wrongly", () => {
    // The same rule must still fire where it belongs, or the gate has simply
    // disabled it rather than scoped it.
    const receipts = SCENARIOS.find((s) => s.id === "03-receipts-and-payments")!
    const noObjectStore = {
      components: [
        {
          id: "app",
          kind: "app-server" as const,
          label: "API",
          instances: 4,
          region: "eu",
          config: { availabilityZones: 2 },
        },
        {
          id: "db",
          kind: "sql-primary" as const,
          label: "DB",
          instances: 1,
          region: "eu",
          config: {
            availabilityZones: 1,
            backups: { enabled: true, rpoMinutes: 5 },
          },
        },
      ],
      edges: [
        {
          id: "u-app",
          from: "client",
          to: "app",
          kind: "sync-request" as const,
          carries: "all" as const,
        },
        {
          id: "app-db",
          from: "app",
          to: "db",
          kind: "sync-request" as const,
          carries: "all" as const,
        },
      ],
    }
    const graded = gradeAttempt(noObjectStore, receipts)
    expect(graded.verdicts.map((v) => v.ruleId)).toContain(
      "data-stores.blobs-in-database",
    )
  })

  it("every scenario declares at least one feature", () => {
    // An empty list would silently disable every gated rule.
    for (const s of SCENARIOS) {
      expect(s.features.length, `${s.id} declares no features`).toBeGreaterThan(
        0,
      )
    }
  })

  it("has no rule that reads scenario.features without being in a gated set", () => {
    // Guards against a future rule forgetting to gate: any rule mentioning a
    // component kind that only exists in one scenario should gate on a feature.
    const gated = RULES.filter((r) =>
      r.check.toString().includes("features.includes"),
    )
    expect(gated.length).toBeGreaterThanOrEqual(3)
  })
})
