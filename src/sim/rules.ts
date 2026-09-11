import { CATALOGUE } from "./catalogue"
import type { EffectiveComponent } from "./simulate"
import { SATURATION_WARN, failureDomains } from "./simulate"
import { CLIENT_NODE_ID } from "./types"
import type {
  ArchitectureGraph,
  FaultEvent,
  LoadProfile,
  Scenario,
  SimulationResult,
  Verdict,
} from "./types"

export type RuleContext = {
  graph: ArchitectureGraph
  components: EffectiveComponent[]
  load: LoadProfile
  scenario: Scenario
  result: SimulationResult
  faults: FaultEvent[]
}

export type Rule = {
  id: string
  category:
    | "topology"
    | "capacity"
    | "consistency"
    | "resilience"
    | "security"
    | "cost"
    | "operability"
  check: (ctx: RuleContext) => Verdict | Verdict[] | null
}

const v = (
  partial: Omit<Verdict, "severity"> & { severity?: Verdict["severity"] },
): Verdict => ({ severity: "fail", ...partial })

/**
 * The rules.
 *
 * Each is a pure predicate over (graph, metrics, scenario). The security probe
 * is not a separate system -- it is this same list filtered to category
 * "security", plus security-flavoured faults.
 */
export const RULES: Rule[] = [
  // --- topology -----------------------------------------------------------
  {
    id: "topology.spof",
    category: "topology",
    check: ({ graph, result }) => {
      const out: Verdict[] = []
      for (const c of graph.components) {
        const spec = CATALOGUE[c.kind]
        if (!spec) continue
        const domains = failureDomains(c, spec)
        const onPath =
          (result.metrics.perComponent[c.id]?.offeredReadRps ?? 0) > 0 ||
          (result.metrics.perComponent[c.id]?.offeredWriteRps ?? 0) > 0
        if (!onPath || domains > 1) continue
        out.push(
          v({
            ruleId: "topology.spof",
            topicIds: ["reliability.redundancy", "reliability.failure-domains"],
            severity: c.kind === "sql-primary" ? "warn" : "fail",
            title: `${c.label} is a single point of failure`,
            explanation:
              c.instances > 1
                ? `${c.instances} instances, but all in one availability zone. Redundancy only counts across independent failure domains -- these fail together, so this is one instance with extra cost.`
                : `One instance carrying live traffic. Lose it and the whole request path stops.`,
            componentIds: [c.id],
            remediationHint:
              c.instances > 1
                ? "Raise availability zones on this component so the instances are actually independent."
                : "Add a second instance and spread it across two availability zones -- or, for a stateful store, decide deliberately that backups are the right answer at this availability target.",
          }),
        )
      }
      return out
    },
  },
  {
    id: "topology.no-lb",
    category: "topology",
    check: ({ graph }) => {
      const out: Verdict[] = []
      for (const c of graph.components) {
        if (c.kind !== "app-server" || c.instances < 2) continue
        const inbound = graph.edges.filter(
          (e) => e.to === c.id && e.kind === "sync-request",
        )
        const fromClient = inbound.some((e) => e.from === CLIENT_NODE_ID)
        const fromLb = inbound.some(
          (e) =>
            graph.components.find((x) => x.id === e.from)?.kind ===
            "load-balancer",
        )
        if (fromClient && !fromLb) {
          out.push(
            v({
              ruleId: "topology.no-lb",
              topicIds: [
                "load-balancing.algorithms",
                "load-balancing.health-checks",
              ],
              title: `${c.instances} app servers with nothing routing to them`,
              explanation:
                "Clients are pointed straight at the app tier, so there is nothing distributing requests across instances and nothing removing an unhealthy instance from rotation. The extra instances are not being used.",
              componentIds: [c.id],
              remediationHint:
                "Put a load balancer between the client and the app tier.",
            }),
          )
        }
      }
      return out
    },
  },
  {
    id: "topology.orphan",
    category: "topology",
    check: ({ graph, result }) => {
      const out: Verdict[] = []
      for (const c of graph.components) {
        const m = result.metrics.perComponent[c.id]
        const connected = graph.edges.some(
          (e) => e.from === c.id || e.to === c.id,
        )
        if (
          connected &&
          (m?.offeredReadRps ?? 0) + (m?.offeredWriteRps ?? 0) > 0
        )
          continue
        out.push(
          v({
            ruleId: "topology.orphan",
            topicIds: ["cost.right-sizing"],
            severity: "warn",
            title: `${c.label} receives no traffic`,
            explanation: connected
              ? "It is wired up but no traffic reaches it, so it is costing money and doing nothing."
              : "It is on the canvas but not connected to anything.",
            componentIds: [c.id],
            remediationHint: "Wire it into the request path or remove it.",
          }),
        )
      }
      return out
    },
  },

  // --- capacity -----------------------------------------------------------
  {
    id: "capacity.saturated",
    category: "capacity",
    check: ({ graph, result }) => {
      const out: Verdict[] = []
      for (const c of graph.components) {
        const m = result.metrics.perComponent[c.id]
        if (!m || m.utilization < SATURATION_WARN) continue
        const dead = !Number.isFinite(m.utilization)
        out.push(
          v({
            ruleId: "capacity.saturated",
            topicIds: [
              "fundamentals.percentiles",
              "scaling.vertical-vs-horizontal",
              "fundamentals.littles-law",
            ],
            severity: m.utilization >= 1 ? "fail" : "warn",
            title: dead
              ? `${c.label} is offline and still receiving traffic`
              : `${c.label} is at ${Math.round(m.utilization * 100)}% utilization`,
            explanation: dead
              ? "Every request routed here is failing."
              : m.utilization >= 1
                ? "Offered load exceeds capacity, so requests are queueing without bound and being dropped."
                : "Past about 80% utilization, queueing means latency climbs far faster than load does. There is no slack left to absorb a burst or the loss of an instance.",
            componentIds: [c.id],
            remediationHint:
              "Add instances, or reduce the load reaching this component (cache, batch, or shed).",
          }),
        )
      }
      return out
    },
  },
  {
    id: "capacity.no-n-plus-one",
    category: "capacity",
    check: ({ graph, result, scenario, faults, load }) => {
      // Only meaningful on a clean run -- during a fault round the instance is
      // already gone and capacity.saturated says the rest. And only at peak,
      // because N+1 is a claim about the worst load the scenario throws.
      if (faults.length > 0) return null
      const peak = scenario.loadProfiles[scenario.loadProfiles.length - 1]
      if (!peak || load.id !== peak.id) return null
      const out: Verdict[] = []
      for (const c of graph.components) {
        const spec = CATALOGUE[c.kind]
        if (!spec || c.instances < 2 || spec.stateful) continue
        const m = result.metrics.perComponent[c.id]
        const offered = m ? m.offeredReadRps + m.offeredWriteRps : 0
        if (offered === 0) continue
        // Capacity with one instance gone. Stateless tiers serve reads and
        // writes from the same pool, so one capacity figure is enough.
        const capacityOneDown = spec.capacity.readRps * (c.instances - 1)
        if (offered > capacityOneDown) {
          out.push(
            v({
              ruleId: "capacity.no-n-plus-one",
              topicIds: ["reliability.redundancy", "scaling.autoscaling"],
              severity: "warn",
              title: `${c.label} cannot survive losing one instance at peak`,
              explanation: `At peak (${peak.peakRps} rps) this tier needs every instance it has. Losing one -- a deploy, a crash, a zone blip -- puts the remainder over capacity, which is exactly when you can least afford it.`,
              componentIds: [c.id],
              remediationHint:
                "Size for peak plus one instance (N+1), not for peak exactly.",
            }),
          )
        }
      }
      return out
    },
  },

  // --- consistency --------------------------------------------------------
  {
    id: "consistency.writes-to-replica",
    category: "consistency",
    check: ({ graph, result }) => {
      const out: Verdict[] = []
      for (const c of graph.components) {
        if (c.kind !== "sql-replica") continue
        const m = result.metrics.perComponent[c.id]
        if (!m || m.offeredWriteRps <= 0) continue
        out.push(
          v({
            ruleId: "consistency.writes-to-replica",
            topicIds: [
              "replication.leader-follower",
              "consistency.read-your-writes",
            ],
            title: `Writes are being routed at ${c.label}`,
            explanation:
              "A read replica cannot accept writes. Every write on this path fails.",
            componentIds: [c.id],
            remediationHint:
              "Set the edge feeding this replica to carry reads only, and send writes to the primary.",
          }),
        )
      }
      return out
    },
  },
  {
    id: "consistency.read-your-writes-broken",
    category: "consistency",
    check: ({ graph, scenario, result }) => {
      if (scenario.requirements.consistency !== "read-your-writes") return null
      const asyncReplica = graph.edges.find(
        (e) => e.kind === "replication" && e.replication?.mode === "async",
      )
      if (!asyncReplica) return null
      const replica = graph.components.find((c) => c.id === asyncReplica.to)
      const servesReads =
        (result.metrics.perComponent[asyncReplica.to]?.offeredReadRps ?? 0) > 0
      if (!replica || !servesReads) return null
      return v({
        ruleId: "consistency.read-your-writes-broken",
        topicIds: [
          "consistency.read-your-writes",
          "replication.lag",
          "consistency.monotonic-reads",
        ],
        title: "Reads can miss the user's own writes",
        explanation: `This scenario requires read-your-writes, but reads are served from ${replica.label}, which trails the primary by ${asyncReplica.replication?.lagMs ?? 0}ms. A user who files a ticket and immediately refreshes can find it missing.`,
        componentIds: [replica.id],
        remediationHint:
          "Route a user's reads to the primary for the lag window after they write, pin their session to the primary, or make replication synchronous and pay the write latency.",
      })
    },
  },
  {
    id: "consistency.stale-beyond-budget",
    category: "consistency",
    check: ({ scenario, result }) => {
      if (scenario.requirements.consistency !== "strong") return null
      const stale = result.metrics.endToEnd.staleReadWindowMs
      if (stale <= 0) return null
      return v({
        ruleId: "consistency.stale-beyond-budget",
        topicIds: ["consistency.pacelc", "caching.ttl-and-staleness"],
        title: `Reads can be up to ${Math.round(stale)}ms stale`,
        explanation:
          "The scenario requires strong consistency, but there is a cache TTL or an asynchronous replication hop on the read path.",
        componentIds: [],
        remediationHint:
          "Remove the stale hop from the read path, or renegotiate the consistency requirement.",
      })
    },
  },

  // --- resilience ---------------------------------------------------------
  {
    id: "resilience.retries-no-jitter",
    category: "resilience",
    check: ({ graph }) => {
      const out: Verdict[] = []
      for (const e of graph.edges) {
        if ((e.retries ?? 0) > 0 && !e.jitter) {
          out.push(
            v({
              ruleId: "resilience.retries-no-jitter",
              topicIds: [
                "reliability.retries-and-jitter",
                "reliability.circuit-breaker",
              ],
              severity: "warn",
              title: "Retries without jitter",
              explanation:
                "Synchronised retries arrive in waves, so a dependency that is struggling gets hit hardest exactly when it is recovering. This turns a brownout into a collapse.",
              componentIds: [e.from, e.to],
              remediationHint:
                "Add jitter to the backoff, and a retry budget so retries cannot exceed a fraction of real traffic.",
            }),
          )
        }
      }
      return out
    },
  },
  {
    id: "resilience.no-timeout",
    category: "resilience",
    check: ({ graph }) => {
      const out: Verdict[] = []
      for (const e of graph.edges) {
        if (e.kind !== "sync-request" || e.from === CLIENT_NODE_ID) continue
        if (e.timeoutMs) continue
        out.push(
          v({
            ruleId: "resilience.no-timeout",
            topicIds: ["reliability.circuit-breaker", "reliability.bulkheads"],
            severity: "warn",
            title: "A synchronous call with no timeout",
            explanation:
              "Without a bound, a slow dependency parks the caller's threads and connections until they are exhausted -- which is how one sick service takes down a healthy one.",
            componentIds: [e.from, e.to],
            remediationHint:
              "Set a timeout on this edge, and a circuit breaker so a dependency that is clearly down stops being called.",
          }),
        )
      }
      return out
    },
  },

  // --- durability / security / cost ---------------------------------------
  {
    id: "durability.no-backups",
    category: "resilience",
    check: ({ graph, scenario }) => {
      if (scenario.requirements.durability === "best-effort") return null
      const out: Verdict[] = []
      for (const c of graph.components) {
        const spec = CATALOGUE[c.kind]
        if (!spec?.supports.backups) continue
        if (c.config.backups?.enabled) continue
        out.push(
          v({
            ruleId: "durability.no-backups",
            topicIds: ["replication.rpo-rto", "reliability.redundancy"],
            title: `${c.label} has no backups`,
            explanation:
              "This scenario requires durable storage. Replication protects against hardware failure; only backups protect against a bad migration, a bad deploy, or a DROP TABLE -- those replicate faithfully and instantly.",
            componentIds: [c.id],
            remediationHint:
              "Enable backups and set an RPO you can defend to the business.",
          }),
        )
      }
      return out
    },
  },
  {
    id: "security.pii-unencrypted",
    category: "security",
    check: ({ graph, scenario }) => {
      const needsPii =
        scenario.requirements.compliance?.includes("pii") ||
        scenario.requirements.durability !== "best-effort"
      if (!needsPii) return null
      const out: Verdict[] = []
      for (const c of graph.components) {
        const spec = CATALOGUE[c.kind]
        if (!spec?.supports.encryptionAtRest || c.config.encryptedAtRest)
          continue
        out.push(
          v({
            ruleId: "security.pii-unencrypted",
            topicIds: [
              "security.encryption-at-rest",
              "security.pii-and-residency",
            ],
            severity: "warn",
            title: `${c.label} stores data unencrypted at rest`,
            explanation:
              "Customer data on an unencrypted volume. Disk-level encryption is close to free on managed stores and is the difference between a lost disk being an incident and being a breach notification.",
            componentIds: [c.id],
            remediationHint: "Turn on encryption at rest.",
          }),
        )
      }
      return out
    },
  },
  {
    id: "security.no-rate-limit",
    category: "security",
    check: ({ graph, faults }) => {
      const underAttack = faults.some(
        (f) =>
          f.kind === "credential-stuffing" ||
          f.kind === "unauthenticated-probe",
      )
      if (!underAttack) return null
      const edge = graph.components.find(
        (c) =>
          c.kind === "load-balancer" ||
          c.kind === "api-gateway" ||
          c.kind === "cdn",
      )
      if (edge?.config.rateLimitRps) return null
      return v({
        ruleId: "security.no-rate-limit",
        topicIds: [
          "security.rate-limiting",
          "security.ddos",
          "messaging.backpressure",
        ],
        title: "No rate limiting at the edge",
        explanation:
          "Nothing at the perimeter bounds how fast a single source can hit the system, so a credential-stuffing run reaches the app tier and the database at full speed and competes with real users for capacity.",
        componentIds: edge ? [edge.id] : [],
        remediationHint:
          "Set a rate limit on the edge component, per client identity rather than globally.",
      })
    },
  },
  {
    id: "security.no-authz",
    category: "security",
    check: ({ graph, faults }) => {
      if (!faults.some((f) => f.kind === "unauthenticated-probe")) return null
      const out: Verdict[] = []
      for (const c of graph.components) {
        if (c.kind !== "app-server" && c.kind !== "api-gateway") continue
        if (c.config.authRequired) continue
        out.push(
          v({
            ruleId: "security.no-authz",
            topicIds: [
              "security.authn-vs-authz",
              "security.zero-trust",
              "security.least-privilege",
            ],
            title: `${c.label} serves requests without requiring authorization`,
            explanation:
              "An unauthenticated probe reached application endpoints. Authentication proves who someone is; authorization decides what they may touch, and this component checks neither.",
            componentIds: [c.id],
            remediationHint:
              "Require auth on this component and check authorization per resource, not just at the perimeter.",
          }),
        )
      }
      return out
    },
  },
  {
    id: "cost.over-budget",
    category: "cost",
    check: ({ scenario, result }) => {
      const cost = result.metrics.endToEnd.estimatedMonthlyCostUsd
      const budget = scenario.requirements.monthlyBudgetUsd
      if (cost <= budget) return null
      return v({
        ruleId: "cost.over-budget",
        topicIds: ["cost.unit-economics", "cost.right-sizing"],
        title: `$${Math.round(cost)}/month against a $${budget} budget`,
        explanation:
          "Over budget. A design that meets every technical requirement and cannot be paid for has not met the requirements -- the budget is one of them.",
        componentIds: [],
        remediationHint:
          "Find the component buying you the least. A read replica is an availability tool: if the availability target is already met without it, it is the first thing to cut.",
      })
    },
  },
  {
    id: "cost.redundant-replica",
    category: "cost",
    check: ({ graph, scenario, result }) => {
      const replica = graph.components.find((c) => c.kind === "sql-replica")
      if (!replica) return null
      const availabilityMet =
        result.metrics.endToEnd.topologyAvailability >=
        scenario.requirements.availability
      if (!availabilityMet) return null
      const spec = CATALOGUE["sql-replica"]
      const cost = spec
        ? Math.round(spec.costPerInstanceHourUsd * 730 * replica.instances)
        : 0
      return v({
        ruleId: "cost.redundant-replica",
        topicIds: [
          "cost.right-sizing",
          "reliability.redundancy",
          "replication.leader-follower",
        ],
        severity: "warn",
        title: `${replica.label} costs $${cost}/month and is not earning it`,
        explanation: `Availability already meets the ${(scenario.requirements.availability * 100).toFixed(2)}% target without it, and the read load fits on the primary. This is the reflex to add redundancy where the requirement did not ask for it.`,
        componentIds: [replica.id],
        remediationHint:
          "Cut it. At a 99.9% target, or once read load genuinely exceeds the primary, it becomes necessary -- that is a later scenario, not this one.",
      })
    },
  },
  {
    id: "scaling.session-affinity",
    category: "topology",
    check: ({ graph }) => {
      const out: Verdict[] = []
      for (const c of graph.components) {
        if (c.kind !== "app-server" || c.instances < 2) continue
        if (c.config.sessionStore !== "in-memory") continue
        out.push(
          v({
            ruleId: "scaling.session-affinity",
            topicIds: ["scaling.session-affinity", "scaling.statelessness"],
            title: `${c.label} keeps sessions in memory across ${c.instances} instances`,
            explanation:
              "A user logs in on one instance; their next request lands on another that has never heard of them, and they are logged out. The instances are not interchangeable, so this tier is not actually horizontally scalable.",
            componentIds: [c.id],
            remediationHint:
              "Stateless signed tokens are the free fix. A shared session store also works but puts a new component on the critical path -- and it must itself be redundant, or you have traded a bug for a single point of failure.",
          }),
        )
      }
      return out
    },
  },
]

export function runRules(ctx: RuleContext): Verdict[] {
  const out: Verdict[] = []
  for (const rule of RULES) {
    const r = rule.check(ctx)
    if (!r) continue
    if (Array.isArray(r)) out.push(...r)
    else out.push(r)
  }
  const order = { fail: 0, warn: 1, info: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}
