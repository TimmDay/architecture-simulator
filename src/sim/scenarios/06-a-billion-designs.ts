import type { ArchitectureGraph, Scenario } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * Reference solution.
 *
 * Three shards behind a router, with the hot account's shard given its own
 * larger allocation rather than pretending the distribution is even. A cache
 * absorbs the read skew, and cross-account queries are served from a search
 * index built for that access pattern rather than by fanning out to every shard.
 */
export const aBillionDesignsReference: ArchitectureGraph = {
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
      label: "Designs API",
      instances: 50,
      region: "us-east-1",
      config: {
        vendor: "ecs",
        availabilityZones: 3,
        sessionStore: "none",
        authRequired: true,
      },
    },
    {
      id: "cache",
      kind: "cache",
      label: "Design cache",
      instances: 3,
      region: "us-east-1",
      config: {
        vendor: "elasticache",
        availabilityZones: 3,
        ttlSeconds: 120,
        stampedeProtection: true,
      },
    },
    {
      id: "router",
      kind: "shard-router",
      label: "Shard router",
      instances: 3,
      region: "us-east-1",
      config: { vendor: "vitess", availabilityZones: 3 },
    },
    {
      // The big account's shard, sized for what it actually receives rather
      // than for an average that does not exist.
      id: "shard-hot",
      kind: "nosql-node",
      label: "Shard A (enterprise)",
      instances: 6,
      region: "us-east-1",
      config: {
        vendor: "dynamodb",
        availabilityZones: 3,
        consistency: "quorum",
        quorum: { n: 3, r: 2, w: 2 },
        encryptedAtRest: true,
        backups: { enabled: true, rpoMinutes: 5 },
      },
    },
    {
      id: "shard-b",
      kind: "nosql-node",
      label: "Shard B",
      instances: 2,
      region: "us-east-1",
      config: {
        vendor: "dynamodb",
        availabilityZones: 3,
        consistency: "quorum",
        quorum: { n: 3, r: 2, w: 2 },
        encryptedAtRest: true,
        backups: { enabled: true, rpoMinutes: 5 },
      },
    },
    {
      id: "shard-c",
      kind: "nosql-node",
      label: "Shard C",
      instances: 2,
      region: "us-east-1",
      config: {
        vendor: "dynamodb",
        availabilityZones: 3,
        consistency: "quorum",
        quorum: { n: 3, r: 2, w: 2 },
        encryptedAtRest: true,
        backups: { enabled: true, rpoMinutes: 5 },
      },
    },
    {
      id: "shared-index",
      kind: "search-index",
      label: '"Shared with me" index',
      instances: 3,
      region: "us-east-1",
      config: {
        vendor: "opensearch",
        availabilityZones: 3,
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
      id: "app-cache",
      from: "app",
      to: "cache",
      kind: "sync-request",
      carries: "reads",
      timeoutMs: 200,
    },
    {
      id: "cache-router",
      from: "cache",
      to: "router",
      kind: "sync-request",
      carries: "reads",
    },
    {
      id: "app-router",
      from: "app",
      to: "router",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 2_000,
      retries: 2,
      jitter: true,
    },
    // Weighted deliberately: the enterprise shard takes four times the traffic
    // of either sibling. Pretending otherwise is how hot partitions hide.
    {
      id: "router-hot",
      from: "router",
      to: "shard-hot",
      kind: "sync-request",
      carries: "all",
      fanout: 4,
    },
    {
      id: "router-b",
      from: "router",
      to: "shard-b",
      kind: "sync-request",
      carries: "all",
      fanout: 1,
    },
    {
      id: "router-c",
      from: "router",
      to: "shard-c",
      kind: "sync-request",
      carries: "all",
      fanout: 1,
    },
    {
      // Cross-account reads do not carry the shard key, so they are served from
      // an index built for them rather than by asking every shard.
      id: "app-shared",
      from: "app",
      to: "shared-index",
      kind: "sync-request",
      carries: "reads",
      fanout: 0.15,
      timeoutMs: 1_000,
      circuitBreaker: true,
    },
  ],
}

/**
 * Scenario 6 -- partitioned data, and the arithmetic that sharding does not fix.
 *
 * Sharding assumes the keys distribute. Real workloads are Zipfian: a handful of
 * accounts are enormous, a handful of templates are used by everybody, and the
 * mean partition load looks healthy right up to the incident. Adding shards adds
 * capacity everywhere except where the load actually is.
 *
 * The second lesson is what you give up. Once the data is split, a query that
 * does not carry the shard key has to ask every shard and wait for the slowest,
 * and a transaction spanning two shards has no cheap way to stay atomic. Both
 * are consequences of the shard key, which is why choosing it is the decision
 * that matters and the one that is hardest to reverse.
 *
 * The hot partition here is expressed as edge weights on the router -- one shard
 * deliberately taking several times its share, which is what a celebrity account
 * looks like from the database's point of view.
 */
export const aBillionDesigns: Scenario = {
  id: "06-a-billion-designs",
  title: "A Billion Designs",
  family: "data-intensive",
  level: 4,

  features: ["user-accounts", "search", "reporting"],

  brief: `There are over a billion designs. One database cannot hold them, and
has not been able to for two years.

The data is already split across shards by account. Most accounts are one
person with forty designs. A few are enterprises with hundreds of thousands of
users, and one of those is about to run a campaign.

Two things are causing pain. A single enterprise account is now large enough
that its shard is doing several times the work of the others, and the team is
out of ideas that do not involve downtime. And the "designs shared with me"
screen has to ask every shard, because sharing crosses account boundaries and
the shard key does not.

Nobody wants to hear the phrase "resharding" this quarter.`,

  requirements: {
    // Higher than the earlier levels on purpose: a hot shard going six
    // times slower is survivable, not invisible, and the budget reflects that.
    p99Ms: 350,
    availability: 0.9995,
    monthlyBudgetUsd: 4_500,
    durability: "durable",
    consistency: "read-your-writes",
    compliance: ["pii"],
  },

  loadProfiles: [
    {
      id: "normal",
      label: "Normal load",
      peakRps: 1_000,
      readWriteRatio: 6,
      shape: "diurnal",
      geography: "multi-region",
      cacheableReadFraction: 0.5,
    },
    {
      id: "busy",
      label: "Term starts",
      peakRps: 3_000,
      readWriteRatio: 5,
      shape: "diurnal",
      geography: "global",
      cacheableReadFraction: 0.45,
    },
    {
      id: "campaign",
      label: "The enterprise account runs its campaign",
      peakRps: 6_000,
      readWriteRatio: 4,
      shape: "spiky",
      geography: "global",
      cacheableReadFraction: 0.4,
    },
  ],

  faultScript: [
    [{ kind: "node-down", componentId: "app", instances: 2 }],
    // The hot shard goes slow before it goes down -- and it takes the requests
    // that had nothing to do with it along for the ride.
    [{ kind: "latency-spike", componentId: "shard-hot", multiplier: 6 }],
    [{ kind: "node-down", componentId: "shard-hot", instances: 1 }],
  ],

  availableKinds: [
    "web-client",
    "cdn",
    "load-balancer",
    "api-gateway",
    "app-server",
    "shard-router",
    "nosql-node",
    "sql-primary",
    "sql-replica",
    "cache",
    "search-index",
    "queue",
    "worker",
  ],

  topicIds: [
    "partitioning.strategies",
    "partitioning.shard-key",
    "partitioning.hot-keys",
    "partitioning.rebalancing",
    "partitioning.cross-shard-queries",
    "partitioning.global-invariants",
    "partitioning.consistent-hashing",
    "consistency.quorum-rw",
    "caching.cache-aside",
    "cost.right-sizing",
  ],
  reference: aBillionDesignsReference,
}
