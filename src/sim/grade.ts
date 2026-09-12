import { simulate } from "./simulate"
import { observabilityVerdicts } from "./observability"
import type {
  ArchitectureGraph,
  Scenario,
  SimulationResult,
  Verdict,
} from "./types"

export type RequirementResult = {
  name: string
  passed: boolean
  actual: string
  required: string
}

export type AttemptResult = {
  baseline: SimulationResult
  /** One entry per round of the fault script. */
  rounds: { label: string; result: SimulationResult; survived: boolean }[]
  requirements: RequirementResult[]
  verdicts: Verdict[]
  passed: boolean
  grade: "A" | "B" | "C" | "D" | "F"
}

function fmtMs(n: number) {
  return `${Math.round(n)}ms`
}
function fmtPct(n: number) {
  return `${(n * 100).toFixed(2)}%`
}

/**
 * Grade an attempt.
 *
 * Requirements are pass/fail against hard numbers; the letter is derived from
 * how many requirements held and how many `fail` verdicts fired. Warnings cost
 * nothing on their own -- they are advice, and a design that meets every
 * requirement while carrying warnings is a design with trade-offs, not a wrong one.
 */
export type ProbeOptions = {
  /**
   * Add the derived observability findings -- would you know this broke, and
   * would you know where? Off by default so the ordinary pressure test stays
   * about whether the design holds, not about how well you would see it fail.
   */
  observability?: boolean
}

export function gradeAttempt(
  graph: ArchitectureGraph,
  scenario: Scenario,
  options: ProbeOptions = {},
): AttemptResult {
  const peak = scenario.loadProfiles[scenario.loadProfiles.length - 1]
  if (!peak) throw new Error(`Scenario ${scenario.id} has no load profiles`)

  const baseline = simulate({ graph, load: peak, faults: [], scenario })

  const rounds = scenario.faultScript.map((faults, i) => {
    const result = simulate({ graph, load: peak, faults, scenario })
    const survived =
      result.metrics.endToEnd.errorRate < 0.01 &&
      result.metrics.endToEnd.p99Ms <= scenario.requirements.p99Ms
    return {
      label: faults.map((f) => f.kind).join(" + ") || `round ${i + 1}`,
      result,
      survived,
    }
  })

  const req = scenario.requirements
  const e2e = baseline.metrics.endToEnd
  const worstFaultP99 = rounds.reduce(
    (w, r) => Math.max(w, r.result.metrics.endToEnd.p99Ms),
    0,
  )

  const requirements: RequirementResult[] = [
    {
      name: "Latency (p99 at peak)",
      passed: e2e.p99Ms <= req.p99Ms,
      actual: fmtMs(e2e.p99Ms),
      required: `<= ${fmtMs(req.p99Ms)}`,
    },
    {
      name: "Availability",
      passed: e2e.topologyAvailability >= req.availability,
      actual: fmtPct(e2e.topologyAvailability),
      required: `>= ${fmtPct(req.availability)}`,
    },
    {
      name: "Cost",
      passed: e2e.estimatedMonthlyCostUsd <= req.monthlyBudgetUsd,
      actual: `$${Math.round(e2e.estimatedMonthlyCostUsd)}/mo`,
      required: `<= $${req.monthlyBudgetUsd}/mo`,
    },
    {
      name: "Survives the pressure test",
      passed: rounds.every((r) => r.survived),
      actual: rounds.every((r) => r.survived)
        ? `all ${rounds.length} round(s) held`
        : `${rounds.filter((r) => !r.survived).length} of ${rounds.length} round(s) failed`,
      required: "every round",
    },
    {
      name: "Latency under fault",
      passed: worstFaultP99 <= req.p99Ms,
      actual: fmtMs(worstFaultP99),
      required: `<= ${fmtMs(req.p99Ms)}`,
    },
  ]

  // Deduplicate: the same rule can fire in the baseline and in every round.
  const seen = new Set<string>()
  const verdicts: Verdict[] = []
  for (const v of [
    ...baseline.verdicts,
    ...rounds.flatMap((r) => r.result.verdicts),
  ]) {
    const key = `${v.ruleId}:${v.componentIds.join(",")}`
    if (seen.has(key)) continue
    seen.add(key)
    verdicts.push(v)
  }

  if (options.observability) {
    verdicts.push(...observabilityVerdicts(graph, baseline, rounds, scenario))
  }

  const failedReqs = requirements.filter((r) => !r.passed).length
  const failVerdicts = verdicts.filter((v) => v.severity === "fail").length
  const passed = failedReqs === 0

  const grade: AttemptResult["grade"] =
    failedReqs === 0 && failVerdicts === 0
      ? "A"
      : failedReqs === 0
        ? "B"
        : failedReqs === 1
          ? "C"
          : failedReqs === 2
            ? "D"
            : "F"

  return { baseline, rounds, requirements, verdicts, passed, grade }
}
