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
        // Nothing you can act on: there is no second zone for a user's laptop,
        // and you cannot scale somebody else's payment provider. Where a third
        // party really is a single point of failure, the useful finding is
        // about circuit breakers, and another rule makes it.
        if (!spec.canAddRedundancy) continue
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
  // --- frontend / API layer -------------------------------------------------
  {
    id: "frontend.ssr-on-app-tier",
    category: "capacity",
    check: ({ graph }) => {
      const client = graph.components.find((c) => c.kind === "web-client")
      if (client?.config.rendering !== "ssr") return null
      const app = graph.components.find((c) => c.kind === "app-server")
      if (!app) return null
      return v({
        ruleId: "frontend.ssr-on-app-tier",
        topicIds: [
          "frontend.rendering-strategy",
          "scaling.vertical-vs-horizontal",
          "caching.cdn",
        ],
        severity: "warn",
        title: "Server rendering is running on your app tier",
        explanation:
          "Every page view now renders HTML on a server you pay for, so each instance serves roughly half the requests it otherwise would. That is a real cost, and it is the price of having pages that are readable without running JavaScript.",
        componentIds: [app.id, client.id],
        remediationHint:
          "Size the app tier for it, cache rendered pages at a CDN where the content allows, or move to static rendering for the pages that do not need per-user HTML.",
      })
    },
  },
  {
    id: "frontend.static-without-cdn",
    category: "cost",
    check: ({ graph }) => {
      const client = graph.components.find((c) => c.kind === "web-client")
      if (client?.config.rendering !== "static") return null
      if (graph.components.some((c) => c.kind === "cdn")) return null
      return v({
        ruleId: "frontend.static-without-cdn",
        topicIds: [
          "frontend.rendering-strategy",
          "caching.cdn",
          "caching.edge-caching",
        ],
        severity: "warn",
        title: "Static rendering with nothing caching it",
        explanation:
          "Pre-rendering pages buys you the ability to serve them from the edge without touching your origin. With no CDN in the design, every one of those pre-rendered pages is still fetched from your own servers, so you have taken the constraint and none of the benefit.",
        componentIds: [client.id],
        remediationHint:
          "Put a CDN in front of it, or choose a rendering mode that needs the origin anyway.",
      })
    },
  },
  {
    id: "frontend.csr-tradeoff",
    category: "operability",
    check: ({ graph }) => {
      const client = graph.components.find((c) => c.kind === "web-client")
      if (client?.config.rendering !== "csr") return null
      return v({
        ruleId: "frontend.csr-tradeoff",
        topicIds: [
          "frontend.rendering-strategy",
          "frontend.bundle-and-caching",
        ],
        severity: "info",
        title:
          "Client rendering keeps your origin cheap and costs you first paint",
        explanation:
          "The bundle is cached once and every page after that is an API call, which is the lightest possible load on your servers. The bill lands on the user's device instead: nothing is visible until the bundle downloads and runs, and a crawler that does not execute JavaScript sees an empty page.",
        componentIds: [client.id],
        remediationHint:
          "Fine when the app sits behind a login. If pages must be indexed or must paint fast on a poor connection, server or static rendering is the trade you want.",
      })
    },
  },
  {
    id: "frontend.client-validation-is-not-enforcement",
    category: "security",
    check: ({ graph }) => {
      const client = graph.components.find((c) => c.kind === "web-client")
      if (!client?.config.clientValidation) return null
      return v({
        ruleId: "frontend.client-validation-is-not-enforcement",
        topicIds: [
          "frontend.client-validation",
          "security.authn-vs-authz",
          "security.zero-trust",
        ],
        severity: "info",
        title: "Client-side validation is a courtesy, not a control",
        explanation:
          "It makes the form pleasant to fill in, and it is bypassed by anyone willing to open devtools or call your API directly. It reduces no risk and, importantly, it does not reduce load either -- a bad request still costs you a round trip once someone skips the form.",
        componentIds: [client.id],
        remediationHint:
          "Keep it for the UX, and validate everything again at the API. Treat the browser as an untrusted client, because it is one.",
      })
    },
  },
  {
    id: "frontend.client-retry-storm",
    category: "resilience",
    check: ({ graph }) => {
      const client = graph.components.find((c) => c.kind === "web-client")
      if (client?.config.clientRetry !== "immediate") return null
      return v({
        ruleId: "frontend.client-retry-storm",
        topicIds: [
          "frontend.client-resilience",
          "reliability.retries-and-jitter",
          "messaging.backpressure",
        ],
        title: "Every browser retries immediately on failure",
        explanation:
          "When the backend stumbles, thousands of clients notice at the same moment and all retry at the same moment. The load arrives in synchronised waves precisely while you are least able to serve it, which is how a brief blip becomes a sustained outage.",
        componentIds: [client.id],
        remediationHint:
          "Exponential backoff with jitter, and a cap on attempts. The jitter is the part that matters -- it is what desynchronises the crowd.",
      })
    },
  },
  {
    id: "api.gateway-over-single-service",
    category: "cost",
    check: ({ graph }) => {
      const gateway = graph.components.find((c) => c.kind === "api-gateway")
      if (!gateway) return null
      const services = graph.components.filter(
        (c) => c.kind === "app-server" || c.kind === "serverless-function",
      )
      if (services.length > 1) return null
      const lb = graph.components.find((c) => c.kind === "load-balancer")
      if (!lb) return null
      return v({
        ruleId: "api.gateway-over-single-service",
        topicIds: [
          "api.gateway-and-bff",
          "cost.right-sizing",
          "load-balancing.l4-vs-l7",
        ],
        severity: "warn",
        title: "A gateway and a load balancer in front of one service",
        explanation:
          "These solve different problems. A load balancer spreads traffic across instances of one service. A gateway is a single front door for many services -- routing by path, per-client rate limits, auth, quotas. With exactly one service behind it, the gateway is doing a job nobody has yet.",
        componentIds: [gateway.id, lb.id],
        remediationHint:
          "Drop it until there is a second service to front, or keep it and drop the load balancer if what you actually wanted was the rate limiting and auth.",
      })
    },
  },
  // --- external dependencies, async work, blobs ---------------------------
  {
    id: "resilience.third-party-on-sync-path",
    category: "resilience",
    check: ({ graph, result }) => {
      const out: Verdict[] = []
      for (const c of graph.components) {
        if (c.kind !== "third-party-api") continue
        const inbound = graph.edges.filter(
          (e) => e.to === c.id && e.kind === "sync-request",
        )
        if (inbound.length === 0) continue
        const unprotected = inbound.filter((e) => !e.circuitBreaker)
        if (unprotected.length === 0) continue
        const spec = CATALOGUE["third-party-api"]
        out.push(
          v({
            ruleId: "resilience.third-party-on-sync-path",
            topicIds: [
              "reliability.circuit-breaker",
              "reliability.graceful-degradation",
              "reliability.bulkheads",
            ],
            title: `${c.label} is on the request path with no circuit breaker`,
            explanation: `You do not own this dependency, cannot scale it, and cannot fix it at 3am. Its ${((1 - (spec?.baselineAvailability ?? 0.995)) * 100).toFixed(1)}% of downtime becomes your downtime, and its p99 of ${spec?.baseLatency.p99Ms ?? 600}ms becomes your floor. When it goes slow rather than down, your own threads pile up waiting on it and take out the endpoints that never needed it.`,
            componentIds: [c.id],
            remediationHint:
              "Put a circuit breaker and a tight timeout on the call, and decide in advance what the product does when it opens -- queue the work and confirm later, or refuse cleanly. Deciding that during the incident is too late.",
          }),
        )
      }
      return out
    },
  },
  {
    id: "transactions.no-idempotency-key",
    category: "consistency",
    check: ({ graph, scenario }) => {
      if (!scenario.features.includes("payments")) return null
      const payment = graph.components.find((c) => c.kind === "third-party-api")
      if (!payment) return null
      const caller = graph.edges.find(
        (e) => e.to === payment.id && e.kind === "sync-request",
      )
      if (!caller) return null
      const app = graph.components.find((c) => c.id === caller.from)
      if (app?.config.idempotencyKeys) return null
      const retries = caller.retries ?? 0
      return v({
        ruleId: "transactions.no-idempotency-key",
        topicIds: [
          "transactions.idempotency",
          "reliability.retries-and-jitter",
          "messaging.delivery-semantics",
        ],
        title: `Calls to ${payment.label} carry no idempotency key`,
        explanation:
          retries > 0
            ? `This call retries ${retries} times. A timeout does not tell you whether the request was processed -- only that you did not hear back -- so every retry risks charging the customer again.`
            : "A network timeout does not tell you whether the other side processed the request, only that you did not hear back. Without a key to deduplicate on, any retry -- yours, a user's double-tap, or a proxy's -- risks a duplicate charge.",
        componentIds: [app?.id ?? payment.id, payment.id],
        remediationHint:
          "Generate the key on the client, per logical operation, and send it with every attempt. The server stores it with the result of the first success and replays that result thereafter. Server-generated keys cannot help a retry that never got a response.",
      })
    },
  },
  {
    id: "data-stores.blobs-in-database",
    category: "capacity",
    check: ({ graph, result, scenario }) => {
      // Only a product that actually takes uploads can put them in the wrong
      // place. Without this gate the rule scolds every scenario that happens
      // to have no object store, receipts or not.
      if (!scenario.features.includes("file-uploads")) return null
      const store = graph.components.find((c) => c.kind === "object-store")
      if (store) return null
      const db = graph.components.find((c) => c.kind === "sql-primary")
      if (!db) return null
      const m = result.metrics.perComponent[db.id]
      if (!m || m.offeredWriteRps <= 0) return null
      return v({
        ruleId: "data-stores.blobs-in-database",
        topicIds: [
          "data-stores.relational-vs-document",
          "cost.unit-economics",
          "caching.cdn",
        ],
        severity: "warn",
        title: "Uploaded files have nowhere to go but the database",
        explanation:
          "There is no object store in this design, so photographs are landing in the relational database. Multi-megabyte rows wreck the buffer cache, bloat every backup, make restores slow enough to matter during an incident, and cost many times per gigabyte what object storage does.",
        componentIds: [db.id],
        remediationHint:
          "Put the bytes in an object store and the URL in the database. Ideally let the phone upload straight to it with a pre-signed URL, so the files never pass through your app tier at all.",
      })
    },
  },
  {
    id: "capacity.slow-work-on-request-path",
    category: "capacity",
    check: ({ graph, scenario }) => {
      if (!scenario.features.includes("background-processing")) return null
      const worker = graph.components.find((c) => c.kind === "worker")
      if (worker) return null
      const app = graph.components.find((c) => c.kind === "app-server")
      if (!app) return null
      return v({
        ruleId: "capacity.slow-work-on-request-path",
        topicIds: [
          "styles.event-driven",
          "messaging.queue-vs-log",
          "fundamentals.littles-law",
        ],
        title: "Expensive processing is happening inside the request",
        explanation:
          "Files are being uploaded but nothing processes them in the background, so the work is happening while the user waits. Image processing takes hundreds of milliseconds of CPU per item -- an order of magnitude more than serving a page -- so it both blows the latency budget and consumes the app tier's capacity for requests that only needed a database read.",
        componentIds: [app.id],
        remediationHint:
          "Accept the upload, put a message on a queue, return immediately, and let workers do the processing. The user gets a fast 202 and the work happens where it can be scaled independently.",
      })
    },
  },
  {
    id: "messaging.no-dlq",
    category: "resilience",
    check: ({ graph, faults }) => {
      const out: Verdict[] = []
      const poisoned = faults.some((f) => f.kind === "poison-message")
      for (const q of graph.components) {
        if (q.kind !== "queue" || q.config.deadLetterQueue) continue
        out.push(
          v({
            ruleId: "messaging.no-dlq",
            topicIds: [
              "messaging.dlq",
              "messaging.ordering",
              "messaging.consumer-lag",
            ],
            severity: poisoned ? "fail" : "warn",
            title: poisoned
              ? `A message ${q.label} cannot process is blocking the line`
              : `${q.label} has no dead-letter queue`,
            explanation: poisoned
              ? "One corrupt upload is being retried forever at the head of the queue. Nothing behind it is being processed, and because nothing is erroring at the API, the backlog grows with every dashboard still green."
              : "One message that always fails -- a corrupt file, a bug on one edge case -- will be retried forever and block everything behind it. Nothing errors; the queue just stops moving.",
            componentIds: [q.id],
            remediationHint:
              "Move a message aside after N failures so the line drains. Then alert on the dead-letter queue's depth and give it an owner -- an unwatched DLQ is a silent data-loss mechanism, which is worse than the blockage it fixed.",
          }),
        )
      }
      return out
    },
  },
  {
    id: "security.card-data-unencrypted",
    category: "security",
    check: ({ graph, scenario }) => {
      if (!scenario.requirements.compliance?.includes("pci")) return null
      const out: Verdict[] = []
      for (const c of graph.components) {
        const spec = CATALOGUE[c.kind]
        if (!spec?.supports.encryptionAtRest || c.config.encryptedAtRest)
          continue
        out.push(
          v({
            ruleId: "security.card-data-unencrypted",
            topicIds: [
              "security.encryption-at-rest",
              "security.pii-and-residency",
              "security.least-privilege",
            ],
            title: `${c.label} holds payment-adjacent data unencrypted`,
            explanation:
              "This scenario is in PCI scope. Receipts and transaction histories are not card numbers, but they are financial records tied to identifiable people, and an unencrypted store is the difference between a lost disk being an incident and being a disclosure.",
            componentIds: [c.id],
            remediationHint:
              "Encrypt at rest everywhere in scope. Better still, never hold the card details at all -- let the provider tokenise them so the data you would have to protect never reaches you.",
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
