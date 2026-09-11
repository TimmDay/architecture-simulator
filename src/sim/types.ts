/**
 * The simulator's data model.
 *
 * Everything here is plain data with no runtime dependencies -- no React, no
 * Firestore, no network. `simulate()` is a pure function over these types, which
 * is what makes a score defensible rather than decorative.
 */

// ---------------------------------------------------------------------------
// Topics -- the shared taxonomy that joins Drill and Build
// ---------------------------------------------------------------------------

/** `domain.subtopic`, e.g. "consistency.read-your-writes". See SPEC.md. */
export type TopicId = string

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export type ComponentKind =
  | "dns"
  | "cdn"
  | "load-balancer"
  | "api-gateway"
  | "app-server"
  | "worker"
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
  /** Downstream calls per inbound request. This is how N+1 becomes measurable. */
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
  /** What the traffic slider spans, ascending. Cost and capacity are graded against the last. */
  loadProfiles: LoadProfile[]
  faultScript: FaultEvent[]
  declarations?: Declaration[]
  /** The palette, scoped deliberately. Decoys are part of the lesson. */
  availableKinds: ComponentKind[]
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
      availability: number
      errorRate: number
      estimatedMonthlyCostUsd: number
      /** max over read paths of async replication lag + cache TTL. */
      staleReadWindowMs: number
    }
  }
  verdicts: Verdict[]
}

export type SimulateInput = {
  graph: ArchitectureGraph
  load: LoadProfile
  faults: FaultEvent[]
  scenario: Scenario
}
