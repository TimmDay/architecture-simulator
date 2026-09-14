import { SCENARIOS } from "./scenarios"
import type { Scenario } from "./types"
import type { ScenarioAttempt } from "~/storage/types"

/**
 * What to build next.
 *
 * Two claims on your time, and revisiting beats advancing. A scenario you
 * failed and never came back to is a gap you already know you have; moving up a
 * level on top of it just stacks the next set of lessons on a foundation that
 * did not hold. So a failure outranks progression, and only once nothing is
 * outstanding does it point at the next level.
 */

export type Recommendation = {
  scenario: Scenario
  reason: "unfinished" | "next-level" | "start" | "review"
  detail: string
  /** Rules you failed here, so the deck can be pointed at the same gaps. */
  failedRuleIds: string[]
}

export type ScenarioProgress = {
  scenario: Scenario
  attempts: number
  bestGrade: string | null
  passed: boolean
  lastAttemptAt: string | null
  failedRuleIds: string[]
}

const GRADE_ORDER = ["F", "D", "C", "B", "A"]

export function scenarioProgress(
  attempts: ScenarioAttempt[],
): ScenarioProgress[] {
  return SCENARIOS.map((scenario) => {
    const mine = attempts
      .filter((a) => a.scenarioId === scenario.id)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const passed = mine.some((a) => a.passed)
    const bestGrade =
      mine.length === 0
        ? null
        : mine.reduce((best, a) =>
            GRADE_ORDER.indexOf(a.grade) > GRADE_ORDER.indexOf(best.grade)
              ? a
              : best,
          ).grade
    return {
      scenario,
      attempts: mine.length,
      bestGrade,
      passed,
      lastAttemptAt: mine[0]?.at ?? null,
      // The most recent attempt's failures are the live ones.
      failedRuleIds: mine[0]?.failedRuleIds ?? [],
    }
  })
}

export function recommend(progress: ScenarioProgress[]): Recommendation | null {
  const attempted = progress.filter((p) => p.attempts > 0)

  if (attempted.length === 0) {
    const first = progress[0]
    return first
      ? {
          scenario: first.scenario,
          reason: "start",
          detail:
            "Start here. It is the smallest system in the set, and every later one assumes it.",
          failedRuleIds: [],
        }
      : null
  }

  // Anything tried and not yet passed, hardest-hit first.
  const unfinished = attempted
    .filter((p) => !p.passed)
    .sort(
      (a, b) =>
        b.attempts - a.attempts ||
        b.failedRuleIds.length - a.failedRuleIds.length,
    )
  const stuck = unfinished[0]
  if (stuck) {
    return {
      scenario: stuck.scenario,
      reason: "unfinished",
      detail:
        stuck.attempts > 1
          ? `You have tried this ${stuck.attempts} times without passing. Going up a level on top of it stacks the next set of lessons on a foundation that did not hold.`
          : "Tried once, not yet passed. Finishing it is worth more than starting something new.",
      failedRuleIds: stuck.failedRuleIds,
    }
  }

  // Everything tried has been passed: move up.
  const highestPassed = Math.max(
    ...attempted.filter((p) => p.passed).map((p) => p.scenario.level),
  )
  const nextUp =
    progress.find(
      (p) => p.attempts === 0 && p.scenario.level <= highestPassed + 1,
    ) ?? progress.find((p) => p.attempts === 0)

  if (nextUp) {
    return {
      scenario: nextUp.scenario,
      reason: "next-level",
      detail: `You have passed everything you have attempted, up to level ${highestPassed}. This is the next one.`,
      failedRuleIds: [],
    }
  }

  // Nothing left unattempted -- revisit the weakest pass.
  const weakest = [...progress]
    .filter((p) => p.attempts > 0)
    .sort(
      (a, b) =>
        GRADE_ORDER.indexOf(a.bestGrade ?? "F") -
        GRADE_ORDER.indexOf(b.bestGrade ?? "F"),
    )[0]
  return weakest
    ? {
        scenario: weakest.scenario,
        reason: "review",
        detail: `You have passed all seven. This was your weakest (${weakest.bestGrade}) — try it under the security and observability probes.`,
        failedRuleIds: weakest.failedRuleIds,
      }
    : null
}
