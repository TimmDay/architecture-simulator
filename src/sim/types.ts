/**
 * The simulator's data model.
 *
 * Everything here is plain data with no runtime dependencies -- no React, no
 * Firestore, no network. `simulate()` is a pure function over these types, which
 * is what makes a score defensible rather than decorative.
 */

import type { TopicId } from "~/topics"

export type { TopicId }

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export type ComponentKind =
  | "dns"
  | "cdn"
  | "load-balancer"
  | "api-gateway"
  | "web-client"
  | "app-server"
  | "third-party-api"
  | "worker"
  | "gpu-worker"
  | "serverless-function"
  | "cache"
  | "sql-primary"
  | "sql-replica"
  | "nosql-node"
  | "shard-router"
  | "queue"
  | "log-stream"
  | "object-store"
  | "search-index"
  | "stream-processor"
  | "data-warehouse"

/**
 * `client` is deliberately NOT a ComponentKind. Every graph has exactly one
 * implicit client node as its entry point -- it is the traffic source, not a
 * thing the player builds. Whatever the client connects to is the entry point
 * for load propagation.
 */
export const CLIENT_NODE_ID = "client"

export type ConsistencyMode = "strong" | "quorum" | "eventual"

/**
 * Who you are buying this from.
 *
 * The family is what matters to the engine: traffic crossing between families
 * leaves one provider's network and enters another's, which costs egress and
 * adds a real network hop. Two AWS services talking to each other do neither.
 */
export type VendorFamily =
  "aws" | "gcp" | "azure" | "cloudflare" | "self-hosted" | "independent"

export type VendorOption = {
  id: string
  label: string
  family: VendorFamily
}

export const VENDOR_FAMILY_LABELS: Record<VendorFamily, string> = {
  aws: "AWS",
  gcp: "Google Cloud",
  azure: "Azure",
  cloudflare: "Cloudflare",
  "self-hosted": "Self-hosted",
  independent: "Independent",
}

export type FailureModeId =
  | "process-crash"
  | "disk-failure"
  | "az-loss"
  | "region-loss"
  | "connection-exhaustion"
  | "cache-eviction-storm"
  | "replication-stall"

export type ComponentSpec = {
  kind: ComponentKind
  label: string
  /**
   * Per instance. Reads and writes are separate because they differ by an order
   * of magnitude on stateful components, and "add a read replica" is only
   * gradable if the engine knows a replica absorbs reads and not writes. For
   * stateless components the two are equal.
   */
  capacity: { readRps: number; writeRps: number }
  baseLatency: { p50Ms: number; p99Ms: number }
  /**
   * Availability of ONE instance in ONE failure domain, as a fraction. Composed
   * across independent domains as 1 - (1-a)^n; instances sharing a domain do not
   * compose. Only ever graded under the fault script -- see SPEC.md "Grading".
   */
  baselineAvailability: number
  stateful: boolean
  durable: boolean
  /**
   * Bought as one logical unit whose redundancy the provider runs for you -- a
   * cloud load balancer, a CDN. For these, zones stand on their own and
   * `baselineAvailability` already reflects the managed SLA.
   *
   * Deliberately FALSE for managed databases and caches. RDS or ElastiCache are
   * operated for you, but multi-AZ there is a deliberate choice you make and pay
   * double for -- a single instance in one zone really is a single point of
   * failure. Marking them managed would hand out that redundancy free and
   * dismantle the backups-are-not-replicas lesson this level is built on.
   */
  managed: boolean
  /**
   * Failure degrades the system rather than breaking it: a cache falls back to
   * the origin, a read replica falls back to the primary, a CDN falls back to
   * the app. These must NOT multiply into serial availability -- doing so says
   * that adding a cache makes a system less available, which is wrong and would
   * teach the opposite of the intended lesson.
   *
   * Note this is a property of how the component is USED, not only of its kind:
   * a cache holding shared sessions is on the critical path and the availability
   * calculation treats it as required.
   */
  optionalOnPath: boolean
  /**
   * Does this component ROUTE traffic or CALL onward?
   *
   * A router (load balancer, gateway, CDN) divides what arrives between its
   * outgoing edges -- 400 rps into two app servers is 200 each. A caller (an app
   * server talking to a database and a cache) makes each of those calls per
   * inbound request, so every outgoing edge carries the full flow, times its
   * `fanout`.
   *
   * Getting this wrong makes a load balancer manufacture traffic out of nothing,
   * which quietly invalidates every capacity number downstream of it.
   */
  routesTraffic: boolean
  /**
   * Runs on the user's device, not on your infrastructure.
   *
   * Such a component is excluded from availability, cost and server-side
   * latency entirely -- a browser app is not a thing you keep up, and counting
   * it in the serial availability product would say that shipping a web app
   * makes your system less reliable. This is distinct from `optionalOnPath`,
   * which is about degrading vs breaking; this is about ownership.
   */
  clientSide: boolean
  /**
   * Can you add redundancy to this yourself?
   *
   * False for a browser app and for somebody else's API: there is no second
   * zone to put a user's laptop in, and you cannot scale a payment provider.
   * The SPOF rule skips these, because "add a second instance across two zones"
   * is not advice you can act on. Where a third party genuinely is a single
   * point of failure, the finding worth making is about circuit breakers and
   * fallbacks, which `resilience.third-party-on-sync-path` makes instead.
   */
  canAddRedundancy: boolean
  /** Real products that fill this role. Empty where the question is meaningless. */
  vendors: VendorOption[]
  /**
   * Serves what it has and passes only its misses onward. True for a CDN as
   * much as for an in-memory cache -- the difference between them is where they
   * sit and what they can hold, not what they do to the flow.
   */
  caches: boolean
  costPerInstanceHourUsd: number
  failureModes: FailureModeId[]
  supports: {
    replicas: boolean
    consistencyModes?: ConsistencyMode[]
    encryptionAtRest?: boolean
    autoscale?: boolean
    backups?: boolean
    sessionStore?: boolean
  }
}

export type RegionId = string

export type PlacedComponent = {
  id: string
  kind: ComponentKind
  label: string
  instances: number
  region: RegionId
  config: {
    /**
     * How many distinct failure domains the instances are spread over.
     * Instances are distributed round-robin; an AZ loss takes every instance in
     * it. Defaults to 1, which means N instances give NO availability benefit --
     * that is the "shared failure domain" trap, and it has to be a lever the
     * player can actually pull or the rule is unfalsifiable.
     */
    availabilityZones?: number
    consistency?: ConsistencyMode
    quorum?: { n: number; r: number; w: number }
    backups?: { enabled: boolean; rpoMinutes: number }
    encryptedAtRest?: boolean
    authRequired?: boolean
    rateLimitRps?: number
    ttlSeconds?: number
    autoscale?: { minInstances: number; maxInstances: number }
    sessionStore?: "in-memory" | "shared" | "none"
    /**
     * How pages reach the user. Not decoration: server rendering moves real
     * work onto the app tier, and static rendering is only worth choosing if
     * something is actually caching it.
     */
    rendering?: "static" | "ssr" | "csr"
    /** Validation in the browser. UX only -- it is trivially bypassed. */
    clientValidation?: boolean
    clientRetry?: "none" | "immediate" | "backoff-jitter"
    /**
     * A hot standby in a second zone, promoted automatically on failure.
     *
     * The third member of a trio worth keeping straight: a BACKUP protects
     * against damage, a READ REPLICA adds read capacity, and a STANDBY adds
     * availability. It doubles the bill and adds no capacity whatsoever, which
     * is precisely why it is a decision rather than a default.
     */
    standby?: boolean
    /** Which product, by `VendorOption.id`. */
    vendor?: string
    /**
     * Request coalescing or early recomputation, so that a key expiring does
     * not send every concurrent reader to the origin at the same instant.
     */
    stampedeProtection?: boolean
    /** A dead-letter queue, so one bad message cannot block the whole line. */
    deadLetterQueue?: boolean
    /** Requests carry an idempotency key, so a retry cannot double-charge. */
    idempotencyKeys?: boolean
  }
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export type EdgeKind = "sync-request" | "async-publish" | "replication" | "cdc"

export type Edge = {
  id: string
  from: string
  to: string
  kind: EdgeKind
  /**
   * Which half of the workload travels this edge. The UI defaults it from the
   * target's kind (a sql-replica gets "reads"), but it stays explicit and
   * overridable so that pointing writes at a read replica is a mistake the
   * player can actually make -- otherwise the rule that catches it can never fire.
   */
  carries?: "reads" | "writes" | "all"
  /**
   * Downstream calls per inbound request. Above 1 this is how N+1 becomes
   * measurable; BELOW 1 it means only a fraction of requests take this path --
   * 0.25 on an upload edge says a quarter of writes are file uploads. Without
   * that, every write would be treated as a photograph.
   */
  fanout?: number
  replication?: { mode: "sync" | "async"; lagMs: number }
  timeoutMs?: number
  retries?: number
  jitter?: boolean
  circuitBreaker?: boolean
}

export type ArchitectureGraph = {
  components: PlacedComponent[]
  edges: Edge[]
}

// ---------------------------------------------------------------------------
// Load and faults
// ---------------------------------------------------------------------------

export type LoadProfile = {
  id: string
  label: string
  /** PEAK requests per second, not mean. Capacity verdicts depend on this. */
  peakRps: number
  /** reads : writes, e.g. 9 means 90% reads. */
  readWriteRatio: number
  shape: "steady" | "diurnal" | "spiky" | "thundering-herd"
  geography: "single-region" | "multi-region" | "global"
  /**
   * Fraction of READ traffic that is cacheable at all. The engine derives a hit
   * ratio from this plus the cache's TTL and the profile's shape -- the player
   * never declares a hit ratio, because a player-declared 99% is free marks.
   */
  cacheableReadFraction: number
}

export type FaultEvent =
  | { kind: "node-down"; componentId: string; instances?: number }
  | { kind: "az-down"; componentId: string; zone: number }
  | { kind: "region-down"; region: RegionId }
  | { kind: "network-partition"; edgeId: string }
  | { kind: "latency-spike"; componentId: string; multiplier: number }
  | { kind: "traffic-spike"; multiplier: number }
  | { kind: "cache-flush"; componentId: string }
  | { kind: "poison-message"; componentId: string }
  | { kind: "credential-stuffing"; rps: number }
  | { kind: "unauthenticated-probe" }

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export type ScenarioId = string

export type ArchitectureFamily =
  | "monolith"
  | "modular-monolith"
  | "microservices"
  | "event-driven"
  | "serverless-edge"
  | "multi-region"
  | "data-intensive"

/**
 * What the product actually does.
 *
 * Rules gate on these so that findings stay inside the scenario. A helpdesk
 * with no photo uploads should never be told its receipts belong in object
 * storage -- that finding belongs to a scenario that has receipts. Without an
 * explicit declaration, any rule written for one scenario leaks into every
 * other one that happens to lack the component it looks for.
 *
 * They are shown to the player too: knowing the system has to take card
 * payments is part of the brief, not a surprise held back for the grading.
 */
export type Feature =
  | "user-accounts"
  | "file-uploads"
  | "background-processing"
  | "payments"
  | "public-content"
  | "search"
  | "reporting"

export const FEATURE_LABELS: Record<Feature, string> = {
  "user-accounts": "Accounts and login",
  "file-uploads": "Users upload files",
  "background-processing": "Work happens after the response",
  payments: "Takes payments",
  "public-content": "Public, crawlable pages",
  search: "Full-text search",
  reporting: "Reporting and exports",
}

export type Requirements = {
  p99Ms: number
  /** Graded ONLY under the fault script, never at baseline. */
  availability: number
  monthlyBudgetUsd: number
  durability: "best-effort" | "durable" | "geo-durable"
  consistency: "strong" | "read-your-writes" | "eventual"
  compliance?: ("pii" | "data-residency" | "pci")[]
}

export type Declaration = {
  id: string
  prompt: string
  askedBefore: FaultEvent["kind"]
  options: { id: string; label: string }[]
  /** Ground truth is derived from the player's graph, never authored. */
  derive: (graph: ArchitectureGraph, fault: FaultEvent) => string
  requiredBy: Requirements["consistency"]
  topicIds: TopicId[]
}

export type Scenario = {
  id: ScenarioId
  title: string
  /** The product/business framing the player reads. */
  brief: string
  family: ArchitectureFamily
  level: 1 | 2 | 3 | 4 | 5
  requirements: Requirements
  /** What the product does. Rules gate on these -- see `Feature`. */
  features: Feature[]
  /** What the traffic slider spans, ascending. Cost and capacity are graded against the last. */
  loadProfiles: LoadProfile[]
  /**
   * Pressure tests, as ROUNDS. Each round is applied to a clean system and its
   * faults fire together; rounds do not accumulate. `[[a], [b]]` tests a and b
   * separately, `[[a, b]]` tests them together, and those are very different
   * tests -- a region loss during a network partition is not the same lesson as
   * either alone.
   */
  faultScript: FaultEvent[][]
  declarations?: Declaration[]
  /** The palette, scoped deliberately. Decoys are part of the lesson. */
  availableKinds: ComponentKind[]
  /**
   * A build that passes every requirement.
   *
   * Not "the" answer -- most scenarios have several -- but a worked one, and
   * the fixture CI grades to make sure the scenario stays winnable. Exposed to
   * the player so it can be inspected after a real attempt.
   */
  reference: ArchitectureGraph
  topicIds: TopicId[]
}

// ---------------------------------------------------------------------------
// Simulation output
// ---------------------------------------------------------------------------

export type Verdict = {
  ruleId: string
  topicIds: TopicId[]
  severity: "info" | "warn" | "fail"
  title: string
  explanation: string
  componentIds: string[]
  remediationHint: string
}

export type ComponentMetrics = {
  offeredReadRps: number
  offeredWriteRps: number
  /** max(rho_read, rho_write) -- the binding constraint, not their sum. */
  utilization: number
  queueDepthApprox: number
  p50Ms: number
  p99Ms: number
  droppedRps: number
}

export type SimulationResult = {
  metrics: {
    perComponent: Record<string, ComponentMetrics>
    endToEnd: {
      p50Ms: number
      p99Ms: number
      /**
       * P(system is up), composed from each component's baselineAvailability
       * across independent failure domains. A property of the TOPOLOGY -- it is
       * the same number with or without a fault applied. This is what the
       * availability requirement is graded against.
       */
      topologyAvailability: number
      errorRate: number
      estimatedMonthlyCostUsd: number
      /** max over read paths of async replication lag + cache TTL. */
      staleReadWindowMs: number
    }
  }
  verdicts: Verdict[]
}

/** The outcome of one round of the fault script. Distinct from topology availability. */
export type FaultRoundResult = {
  faults: FaultEvent[]
  /** Did the system still serve traffic inside the scenario's SLO? */
  survived: boolean
  errorRate: number
  p99Ms: number
  verdicts: Verdict[]
}

export type SimulateInput = {
  graph: ArchitectureGraph
  load: LoadProfile
  /** One round's faults, applied together. Empty array = the baseline run. */
  faults: FaultEvent[]
  scenario: Scenario
}
