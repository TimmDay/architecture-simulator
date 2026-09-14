import type { ArchitectureGraph, Scenario } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * Reference solution.
 *
 * The editor writes to its own database and publishes to the log. Two entirely
 * independent consumer groups read the whole stream: one indexes for search, one
 * aggregates for analytics. Neither knows about the other, and neither can slow
 * the editor down.
 */
export const everythingDownstreamReference: ArchitectureGraph = {
  components: [
    {
      id: "lb",
      kind: "load-balancer",
      label: "Load balancer",
      instances: 1,
      region: "us-east-1",
      config: { vendor: "alb", availabilityZones: 3 },
    },
    {
      id: "app",
      kind: "app-server",
      label: "Editor API",
      instances: 20,
      region: "us-east-1",
      config: {
        vendor: "ecs",
        availabilityZones: 3,
        sessionStore: "none",
        authRequired: true,
      },
    },
    {
      id: "db",
      kind: "sql-primary",
      label: "Designs database",
      instances: 1,
      region: "us-east-1",
      config: {
        vendor: "rds",
        availabilityZones: 1,
        consistency: "strong",
        standby: true,
        backups: { enabled: true, rpoMinutes: 5 },
        encryptedAtRest: true,
      },
    },
    {
      id: "events",
      kind: "log-stream",
      label: "design.updated",
      instances: 3,
      region: "us-east-1",
      config: { vendor: "msk", availabilityZones: 3 },
    },
    {
      id: "indexer",
      kind: "worker",
      label: "Search indexer group",
      instances: 10,
      region: "us-east-1",
      config: { vendor: "ecs", availabilityZones: 3, idempotencyKeys: true },
    },
    {
      id: "search",
      kind: "search-index",
      label: "Search index",
      instances: 3,
      region: "us-east-1",
      config: {
        vendor: "opensearch",
        availabilityZones: 3,
        encryptedAtRest: true,
      },
    },
    {
      id: "analytics",
      kind: "stream-processor",
      label: "Analytics group",
      instances: 3,
      region: "us-east-1",
      config: { vendor: "flink", availabilityZones: 3 },
    },
    {
      id: "warehouse",
      kind: "data-warehouse",
      label: "Warehouse",
      instances: 1,
      region: "us-east-1",
      config: {
        vendor: "snowflake",
        availabilityZones: 2,
        encryptedAtRest: true,
      },
    },
  ],

  edges: [
    {
      id: "u-lb",
      from: CLIENT_NODE_ID,
      to: "lb",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "lb-app",
      from: "lb",
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
      timeoutMs: 2_000,
      retries: 2,
      jitter: true,
    },
    {
      // Published after the write commits. The editor does not wait for anyone.
      id: "app-events",
      from: "app",
      to: "events",
      kind: "async-publish",
      carries: "writes",
    },
    // Two consumer GROUPS. A log is not a queue: each of these receives the
    // entire stream, not a share of it.
    {
      id: "events-indexer",
      from: "events",
      to: "indexer",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "events-analytics",
      from: "events",
      to: "analytics",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "indexer-search",
      from: "indexer",
      to: "search",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 5_000,
    },
    {
      id: "analytics-warehouse",
      from: "analytics",
      to: "warehouse",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 30_000,
    },
    {
      id: "app-search",
      from: "app",
      to: "search",
      kind: "sync-request",
      carries: "reads",
      fanout: 0.2,
      // A search call on a page render gets 100ms and a breaker. If search is
      // slow, the page renders without it -- that is the trade, made here in
      // the design rather than at 2am.
      timeoutMs: 100,
      circuitBreaker: true,
    },
  ],
}

/**
 * Scenario 5 -- event streams, and the difference between a log and a queue.
 *
 * One user action, several independent reactions, none of which the writer
 * should have to know about. A queue cannot express this: it delivers each
 * message to exactly one consumer and then deletes it. A log retains the
 * sequence and lets each consumer group read all of it at its own position,
 * which is what makes "add another consumer next quarter" a config change
 * rather than a redesign.
 *
 * The trap is treating the log as a queue and expecting the stream to be
 * divided between the search indexer and the analytics pipeline. It is not.
 * Every group gets everything, and the engine models it that way.
 */
export const everythingDownstream: Scenario = {
  id: "05-everything-downstream",
  title: "Everything Downstream",
  family: "event-driven",
  level: 4,

  features: ["user-accounts", "search", "reporting", "background-processing"],

  brief: `Every time someone edits a design, several things need to know.

Search has to re-index it so the owner can find it by name. Analytics needs it
for the dashboards the business runs on. Next quarter there will be a
recommendations service, and the quarter after that, someone from compliance
will ask for an audit trail going back a year.

The team that owns the editor should not have to be told about any of them.

Saving a design must feel instant. Search being a few seconds stale is fine.
Analytics being an hour stale is fine. None of them may lose an event.`,

  requirements: {
    p99Ms: 250,
    availability: 0.999,
    monthlyBudgetUsd: 3_000,
    durability: "durable",
    // The authoritative write is strong; everything downstream is derived.
    consistency: "read-your-writes",
  },

  loadProfiles: [
    {
      id: "steady",
      label: "Steady editing",
      peakRps: 400,
      readWriteRatio: 3,
      shape: "diurnal",
      geography: "single-region",
      cacheableReadFraction: 0.3,
    },
    {
      id: "busy",
      label: "Monday morning",
      peakRps: 1_200,
      readWriteRatio: 2.5,
      shape: "diurnal",
      geography: "multi-region",
      cacheableReadFraction: 0.3,
    },
    {
      id: "peak",
      label: "Back-to-school, every school at once",
      peakRps: 1_500,
      readWriteRatio: 5,
      shape: "spiky",
      geography: "global",
      cacheableReadFraction: 0.25,
    },
  ],

  faultScript: [
    [{ kind: "node-down", componentId: "app", instances: 1 }],
    // A consumer dies. Does it resume from its last committed offset, or does
    // it lose the events it had read but not committed?
    [{ kind: "node-down", componentId: "indexer", instances: 2 }],
    // The indexer falls behind rather than falling over: the quiet failure.
    [{ kind: "latency-spike", componentId: "search", multiplier: 10 }],
  ],

  availableKinds: [
    "web-client",
    "load-balancer",
    "api-gateway",
    "app-server",
    "log-stream",
    "queue",
    "worker",
    "stream-processor",
    "search-index",
    "data-warehouse",
    "cache",
    "sql-primary",
    "sql-replica",
  ],

  topicIds: [
    "messaging.queue-vs-log",
    "messaging.kafka-partitions",
    "messaging.consumer-groups",
    "messaging.offsets",
    "messaging.ordering",
    "messaging.consumer-lag",
    "messaging.delivery-semantics",
    "transactions.outbox",
    "styles.event-driven",
    "consistency.eventual",
    "org.ownership-boundaries",
  ],
  reference: everythingDownstreamReference,
}
