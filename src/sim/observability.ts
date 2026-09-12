import { CATALOGUE } from "./catalogue"
import { isOptionalOnPath } from "./simulate"
import type {
  ArchitectureGraph,
  Scenario,
  SimulationResult,
  Verdict,
} from "./types"

/**
 * The observability probe.
 *
 * Deliberately NOT a checklist of tools you have or have not bought -- "add
 * tracing" is advice, not a finding. The question it answers is the one that
 * actually matters on a Tuesday afternoon: when this breaks, will you know, and
 * will you know where?
 *
 * The interesting failures are the quiet ones. A system that returns errors is
 * a system whose dashboards go red and whose pager fires; you will find out
 * within minutes whether or not you instrumented it well. A system that stays
 * at a 0% error rate while serving every request twice as slowly, or that has
 * silently lost the redundancy it was relying on, is the one that gets
 * discovered by a customer three weeks later.
 *
 * So these verdicts are DERIVED by comparing each fault round against the
 * baseline, rather than by inspecting a list of configured tools. They cannot
 * be ordinary rules, because a rule only ever sees one round.
 */

/** How much worse latency has to get before "nobody would notice" stops being true. */
const LATENCY_ALARM_RATIO = 1.5
/** Below this error rate, nothing is going red on its own. */
const QUIET_ERROR_RATE = 0.01

export type Round = {
  label: string
  result: SimulationResult
  survived: boolean
}

export function observabilityVerdicts(
  graph: ArchitectureGraph,
  baseline: SimulationResult,
  rounds: Round[],
  scenario: Scenario,
): Verdict[] {
  const out: Verdict[] = []
  const basep99 = Math.max(1, baseline.metrics.endToEnd.p99Ms)

  for (const round of rounds) {
    const e2e = round.result.metrics.endToEnd
    const quiet = e2e.errorRate < QUIET_ERROR_RATE
    const ratio = e2e.p99Ms / basep99

    // 1. Degraded badly, returned no errors. The classic green-dashboard outage.
    if (quiet && ratio >= LATENCY_ALARM_RATIO) {
      out.push({
        ruleId: "observability.silent-degradation",
        topicIds: [
          "observability.alerting-on-symptoms",
          "observability.red-and-use",
          "reliability.slo-sli-error-budget",
        ],
        severity: round.survived ? "warn" : "fail",
        title: `"${round.label}" made the system ${ratio.toFixed(1)}× slower and returned no errors`,
        explanation: `p99 went from ${Math.round(basep99)}ms to ${Math.round(e2e.p99Ms)}ms while the error rate stayed at ${(e2e.errorRate * 100).toFixed(1)}%. Nothing here fails, so nothing goes red. If your alerting watches error rates and host health, this outage is invisible to you and your users find it first.`,
        componentIds: saturatedComponents(round.result),
        remediationHint:
          "Alert on latency percentiles against your SLO, not just on errors and CPU. A request that eventually succeeds after eight seconds has already failed the user.",
      })
    }

    // 2. Lost redundancy without losing service. Nothing breaks -- yet.
    const deadOptional = graph.components.filter((c) => {
      const spec = CATALOGUE[c.kind]
      if (!spec || !isOptionalOnPath(c, spec)) return false
      const m = round.result.metrics.perComponent[c.id]
      return m ? !Number.isFinite(m.utilization) : false
    })
    if (quiet && deadOptional.length > 0) {
      out.push({
        ruleId: "observability.invisible-redundancy-loss",
        topicIds: [
          "observability.metrics-logs-traces",
          "reliability.redundancy",
          "reliability.failure-domains",
        ],
        severity: "warn",
        title: `${deadOptional.map((c) => c.label).join(", ")} failed and the system carried on regardless`,
        explanation:
          "Exactly what a fallback path is for -- and exactly why it goes unnoticed. Users saw nothing, error rates did not move, and the safety margin you were relying on is now gone. The next failure is the one that takes you down, and you will meet it without knowing you were already one component short.",
        componentIds: deadOptional.map((c) => c.id),
        remediationHint:
          "Alert on the health of fallback paths directly, not on their effect. A degraded-but-working system needs a ticket, not silence.",
      })
    }

    // 3. Nothing fell over at all -- this round was genuinely well handled.
    if (
      round.survived &&
      quiet &&
      ratio < LATENCY_ALARM_RATIO &&
      deadOptional.length === 0
    ) {
      out.push({
        ruleId: "observability.clean-absorption",
        topicIds: ["reliability.redundancy", "observability.red-and-use"],
        severity: "info",
        title: `"${round.label}" was absorbed without users noticing`,
        explanation:
          "Latency held and no requests failed. This is the outcome you want, and it is worth naming: the redundancy did its job silently.",
        componentIds: [],
        remediationHint:
          "Make sure it is not silent to you as well -- the instance that died should still raise a ticket even though nobody was affected.",
      })
    }
  }

  // 4. Structural blind spot: a cache can serve happily from memory while the
  // store behind it is on fire, and hide the outage for as long as its TTL.
  const cache = graph.components.find(
    (c) => c.kind === "cache" && (c.config.ttlSeconds ?? 0) > 0,
  )
  const store = graph.components.find(
    (c) => c.kind === "sql-primary" || c.kind === "sql-replica",
  )
  if (cache && store) {
    const ttl = cache.config.ttlSeconds ?? 0
    out.push({
      ruleId: "observability.cache-masks-origin",
      topicIds: [
        "caching.ttl-and-staleness",
        "observability.alerting-on-symptoms",
        "caching.invalidation",
      ],
      severity: "info",
      title: `${cache.label} can hide an origin outage for up to ${ttl}s`,
      explanation: `While entries are warm, reads are served without touching ${store.label}. If the store fails, traffic looks perfectly healthy until the TTL expires -- then every key misses at once and the failure arrives all together, as a cliff rather than a slope.`,
      componentIds: [cache.id, store.id],
      remediationHint:
        "Monitor the origin's health directly rather than inferring it from user-facing success, and watch cache hit rate: a rising hit rate during an incident is a warning, not a win.",
    })
  }

  const order = { fail: 0, warn: 1, info: 2 } as const
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}

function saturatedComponents(result: SimulationResult): string[] {
  return Object.entries(result.metrics.perComponent)
    .filter(([, m]) => m.utilization >= 0.8)
    .map(([id]) => id)
}

/** Is a scenario's fault script mostly quiet? Used to headline the probe. */
export function silentRoundCount(
  baseline: SimulationResult,
  rounds: Round[],
): number {
  const basep99 = Math.max(1, baseline.metrics.endToEnd.p99Ms)
  return rounds.filter((r) => {
    const e2e = r.result.metrics.endToEnd
    return (
      e2e.errorRate < QUIET_ERROR_RATE &&
      e2e.p99Ms / basep99 >= LATENCY_ALARM_RATIO
    )
  }).length
}
