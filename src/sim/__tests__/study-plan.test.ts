import { describe, expect, it } from "vitest"
import { recommend, scenarioProgress } from "../study-plan"
import { SCENARIOS } from "../scenarios"
import type { ScenarioAttempt } from "~/storage/types"

const attempt = (
  scenarioId: string,
  passed: boolean,
  grade = passed ? "A" : "D",
  at = "2026-03-01T09:00:00Z",
  failedRuleIds: string[] = [],
): ScenarioAttempt => ({
  id: `${scenarioId}-${at}-${grade}`,
  scenarioId,
  at,
  passed,
  grade,
  requirementResults: [],
  failedRuleIds,
})

describe("what to build next", () => {
  it("starts you at the smallest system", () => {
    const r = recommend(scenarioProgress([]))
    expect(r?.reason).toBe("start")
    expect(r?.scenario.level).toBe(1)
  })

  it("sends you back to something you failed rather than forward", () => {
    // Revisiting beats advancing: moving up on a foundation that did not hold
    // just stacks the next lessons on the gap.
    const attempts = [
      attempt(SCENARIOS[0]!.id, true),
      attempt(SCENARIOS[1]!.id, false, "D", "2026-03-02T09:00:00Z", [
        "topology.spof",
      ]),
    ]
    const r = recommend(scenarioProgress(attempts))
    expect(r?.reason).toBe("unfinished")
    expect(r?.scenario.id).toBe(SCENARIOS[1]!.id)
    expect(r?.failedRuleIds).toContain("topology.spof")
  })

  it("prefers the one you have failed most often", () => {
    const attempts = [
      attempt(SCENARIOS[1]!.id, false, "D", "2026-03-01T09:00:00Z"),
      attempt(SCENARIOS[2]!.id, false, "C", "2026-03-02T09:00:00Z"),
      attempt(SCENARIOS[2]!.id, false, "C", "2026-03-03T09:00:00Z"),
      attempt(SCENARIOS[2]!.id, false, "C", "2026-03-04T09:00:00Z"),
    ]
    expect(recommend(scenarioProgress(attempts))?.scenario.id).toBe(
      SCENARIOS[2]!.id,
    )
  })

  it("moves you up once everything attempted has been passed", () => {
    const attempts = [
      attempt(SCENARIOS[0]!.id, true),
      attempt(SCENARIOS[1]!.id, true),
    ]
    const r = recommend(scenarioProgress(attempts))
    expect(r?.reason).toBe("next-level")
    expect(r?.scenario.level).toBeLessThanOrEqual(3)
  })

  it("does not jump you two levels ahead", () => {
    const r = recommend(scenarioProgress([attempt(SCENARIOS[0]!.id, true)]))
    expect(r?.scenario.level).toBeLessThanOrEqual(2)
  })

  it("points at your weakest pass once nothing is left unattempted", () => {
    const attempts = SCENARIOS.map((s, i) =>
      attempt(
        s.id,
        true,
        i === 3 ? "C" : "A",
        `2026-03-0${(i % 9) + 1}T09:00:00Z`,
      ),
    )
    const r = recommend(scenarioProgress(attempts))
    expect(r?.reason).toBe("review")
    expect(r?.scenario.id).toBe(SCENARIOS[3]!.id)
  })

  it("records a pass even if a later attempt failed", () => {
    const p = scenarioProgress([
      attempt(SCENARIOS[0]!.id, true, "A", "2026-03-01T09:00:00Z"),
      attempt(SCENARIOS[0]!.id, false, "F", "2026-03-05T09:00:00Z"),
    ])
    expect(p[0]!.passed).toBe(true)
    expect(p[0]!.bestGrade).toBe("A")
  })
})
