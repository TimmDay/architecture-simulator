import { describe, expect, it } from "vitest"
import { gradeAttempt } from "../grade"
import { simulate } from "../simulate"
import {
  firstRealCustomers as scenario,
  firstRealCustomersReference as reference,
} from "../scenarios/01-first-real-customers"
import type { ArchitectureGraph } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * This replaces the throwaway harness in docs/scenario-01-arithmetic.mjs. That
 * file computed the same claims with its own copy of the physics; this asserts
 * them against the real engine, so a catalogue change that quietly makes the
 * scenario unwinnable fails CI instead of failing a learner.
 */
describe("scenario 1: the reference solution", () => {
  const graded = gradeAttempt(reference, scenario)

  it("passes every requirement", () => {
    const failures = graded.requirements.filter((r) => !r.passed)
    expect(
      failures,
      `failing: ${failures.map((f) => `${f.name} (${f.actual})`).join(", ")}`,
    ).toEqual([])
    expect(graded.passed).toBe(true)
  })

  it("fits the budget with room to spare", () => {
    const cost = graded.baseline.metrics.endToEnd.estimatedMonthlyCostUsd
    expect(cost).toBeLessThanOrEqual(scenario.requirements.monthlyBudgetUsd)
    expect(Math.round(cost)).toBe(259)
  })

  it("survives losing an app instance at peak", () => {
    expect(graded.rounds).toHaveLength(1)
    expect(graded.rounds[0]?.survived).toBe(true)
  })

  it("raises no fail-severity verdicts", () => {
    const fails = graded.verdicts.filter((v) => v.severity === "fail")
    expect(fails.map((f) => f.ruleId)).toEqual([])
  })
})

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
      config: {
        availabilityZones: 1,
        backups: { enabled: true, rpoMinutes: 5 },
        encryptedAtRest: true,
      },
    },
  ],
  edges: [
    {
      id: "client-app",
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
      timeoutMs: 2000,
    },
  ],
}

describe("scenario 1: the naive build", () => {
  it("looks fine at the quiet baseline profile -- this is the teaching beat", () => {
    const quiet = scenario.loadProfiles[0]!
    const r = simulate({ graph: naive, load: quiet, faults: [], scenario })
    expect(r.metrics.endToEnd.p99Ms).toBeLessThanOrEqual(
      scenario.requirements.p99Ms,
    )
    expect(r.metrics.endToEnd.estimatedMonthlyCostUsd).toBeLessThanOrEqual(
      scenario.requirements.monthlyBudgetUsd,
    )
  })

  it("collapses when the one app instance dies", () => {
    const graded = gradeAttempt(naive, scenario)
    expect(graded.rounds[0]?.survived).toBe(false)
    expect(graded.rounds[0]?.result.metrics.endToEnd.errorRate).toBe(1)
    expect(graded.passed).toBe(false)
  })

  it("is flagged as a single point of failure", () => {
    const graded = gradeAttempt(naive, scenario)
    expect(graded.verdicts.map((v) => v.ruleId)).toContain("topology.spof")
  })
})

describe("scenario 1: the gold-plated build", () => {
  const gold: ArchitectureGraph = {
    components: [
      ...reference.components,
      {
        id: "replica",
        kind: "sql-replica",
        label: "Read replica",
        instances: 1,
        region: "eu-west-1",
        config: { availabilityZones: 1, encryptedAtRest: true },
      },
    ],
    edges: [
      ...reference.edges,
      {
        id: "app-replica",
        from: "app",
        to: "replica",
        kind: "sync-request",
        carries: "reads",
        timeoutMs: 2000,
      },
      {
        id: "db-replica",
        from: "db",
        to: "replica",
        kind: "replication",
        replication: { mode: "async", lagMs: 200 },
      },
    ],
  }

  it("is priced out of the budget", () => {
    const graded = gradeAttempt(gold, scenario)
    const cost = graded.baseline.metrics.endToEnd.estimatedMonthlyCostUsd
    expect(Math.round(cost)).toBe(383)
    expect(graded.requirements.find((r) => r.name === "Cost")?.passed).toBe(
      false,
    )
  })

  it("is told the replica is not earning its keep", () => {
    const graded = gradeAttempt(gold, scenario)
    expect(graded.verdicts.map((v) => v.ruleId)).toContain(
      "cost.redundant-replica",
    )
  })
})
