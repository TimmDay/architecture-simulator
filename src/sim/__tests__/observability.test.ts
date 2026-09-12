import { describe, expect, it } from "vitest"
import { gradeAttempt } from "../grade"
import { simulate } from "../simulate"
import {
  firstRealCustomers as scenario,
  firstRealCustomersReference as reference,
} from "../scenarios/01-first-real-customers"
import type { FaultEvent, Scenario } from "../types"

const peak = scenario.loadProfiles[2]!

const withFaults = (rounds: FaultEvent[][]): Scenario => ({
  ...scenario,
  faultScript: [...scenario.faultScript, ...rounds],
})

describe("latency-spike faults", () => {
  it("make a dependency slow without making it fail", () => {
    const clean = simulate({
      graph: reference,
      load: peak,
      faults: [],
      scenario,
    })
    const slow = simulate({
      graph: reference,
      load: peak,
      faults: [{ kind: "latency-spike", componentId: "db", multiplier: 6 }],
      scenario,
    })
    expect(slow.metrics.endToEnd.p99Ms).toBeGreaterThan(
      clean.metrics.endToEnd.p99Ms,
    )
    // Nothing errors. That is exactly what makes it dangerous.
    expect(slow.metrics.endToEnd.errorRate).toBe(0)
  })
})

describe("the observability probe", () => {
  const slowDb: FaultEvent[][] = [
    [{ kind: "latency-spike", componentId: "db", multiplier: 6 }],
  ]

  it("catches a bad slowdown that returns no errors", () => {
    const graded = gradeAttempt(reference, withFaults(slowDb), {
      observability: true,
    })
    const silent = graded.verdicts.find(
      (v) => v.ruleId === "observability.silent-degradation",
    )
    expect(silent).toBeDefined()
    expect(silent?.explanation).toContain("error rate")
  })

  it("stays quiet about it when the probe is not requested", () => {
    // The ordinary pressure test is about whether the design holds, not about
    // how well you would see it fail.
    const graded = gradeAttempt(reference, withFaults(slowDb))
    expect(graded.verdicts.map((v) => v.ruleId)).not.toContain(
      "observability.silent-degradation",
    )
  })

  it("credits a fault the design absorbed cleanly", () => {
    const graded = gradeAttempt(reference, scenario, { observability: true })
    const clean = graded.verdicts.find(
      (v) => v.ruleId === "observability.clean-absorption",
    )
    expect(clean?.severity).toBe("info")
  })

  it("never damages the grade with advisory findings", () => {
    const plain = gradeAttempt(reference, scenario)
    const probed = gradeAttempt(reference, scenario, { observability: true })
    expect(probed.grade).toBe(plain.grade)
    expect(probed.requirements).toEqual(plain.requirements)
  })

  it("warns that a cache can hide an origin outage", () => {
    const withCache = {
      components: [
        ...reference.components,
        {
          id: "cache",
          kind: "cache" as const,
          label: "Session cache",
          instances: 2,
          region: "eu-west-1",
          config: { availabilityZones: 2, ttlSeconds: 300 },
        },
      ],
      edges: [
        ...reference.edges,
        {
          id: "app-cache",
          from: "app",
          to: "cache",
          kind: "sync-request" as const,
          carries: "reads" as const,
        },
      ],
    }
    const graded = gradeAttempt(withCache, scenario, { observability: true })
    const masked = graded.verdicts.find(
      (v) => v.ruleId === "observability.cache-masks-origin",
    )
    expect(masked?.title).toContain("300s")
  })

  it("resolves every finding's topics to cards that exist", () => {
    // A probe whose topics match no card is a feedback loop that silently does
    // nothing -- the failure mode the typed TopicId union exists to prevent.
    const graded = gradeAttempt(reference, withFaults(slowDb), {
      observability: true,
    })
    const obs = graded.verdicts.filter((v) =>
      v.ruleId.startsWith("observability."),
    )
    expect(obs.length).toBeGreaterThan(0)
    for (const v of obs) expect(v.topicIds.length).toBeGreaterThan(0)
  })
})
