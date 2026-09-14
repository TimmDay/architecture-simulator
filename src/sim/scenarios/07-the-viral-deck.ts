import type { ArchitectureGraph, Scenario } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * Scenario 7 -- high-read delivery, and deciding in advance what to give up.
 *
 * Everything here is derived state that tolerates controlled staleness, which
 * means almost none of this traffic should reach the authoritative store. The
 * interesting part is not the happy path -- it is the two failures.
 *
 * A cache that empties sends every concurrent reader to the origin at the same
 * instant, and the origin was never sized for that. A partition between the
 * edge and the store forces the choice the CAP theorem is actually about: serve
 * something stale, or serve an error. For a public presentation being read by
 * strangers, refusing to answer is the wrong answer -- but it has to be a
 * decision made now, in the design, not at 2am by whoever is on call.
 */
export const theViralDeck: Scenario = {
  id: "07-the-viral-deck",
  title: "The Viral Deck",
  family: "modular-monolith",
  level: 4,

  features: ["public-content", "user-accounts", "reporting"],

  brief: `Users can publish a design as a public page. Most are read by nobody.

One of them is a conference keynote that has just been linked from everywhere,
and it is being opened about forty thousand times a minute by people who will
never log in. The content changed once, this morning, and will not change again.

The same service also serves the editor, where people are working on documents
they very much expect to be up to date.

Your database is the one that holds everything. If public traffic takes it down,
it takes the editor with it.

Somebody will ask, afterwards, why the page could not simply have been served
from cache. Make sure the answer is that it was.`,

  requirements: {
    p99Ms: 300,
    availability: 0.9995,
    monthlyBudgetUsd: 2_500,
    durability: "durable",
    // Published pages are derived state. Staleness is acceptable; refusing to
    // serve is not.
    consistency: "eventual",
  },

  loadProfiles: [
    {
      id: "normal",
      label: "Normal publishing traffic",
      peakRps: 500,
      readWriteRatio: 15,
      shape: "diurnal",
      geography: "global",
      cacheableReadFraction: 0.9,
    },
    {
      id: "popular",
      label: "It gets shared around",
      peakRps: 4_000,
      readWriteRatio: 50,
      shape: "spiky",
      geography: "global",
      cacheableReadFraction: 0.95,
    },
    {
      id: "viral",
      label: "Forty thousand a minute, all on one page",
      peakRps: 12_000,
      readWriteRatio: 200,
      shape: "thundering-herd",
      geography: "global",
      cacheableReadFraction: 0.98,
    },
  ],

  faultScript: [
    // The stampede: everything expires at once and the origin meets the crowd.
    [{ kind: "cache-flush", componentId: "cache" }],
    // The CAP moment: the read path cannot reach the authoritative store.
    [{ kind: "network-partition", edgeId: "cache-db" }],
    [{ kind: "node-down", componentId: "app", instances: 2 }],
  ],

  availableKinds: [
    "web-client",
    "cdn",
    "load-balancer",
    "api-gateway",
    "app-server",
    "cache",
    "sql-primary",
    "sql-replica",
    "object-store",
    "queue",
    "worker",
  ],

  topicIds: [
    "caching.cdn",
    "caching.edge-caching",
    "caching.stampede",
    "caching.ttl-and-staleness",
    "caching.invalidation",
    "consistency.cap",
    "consistency.eventual",
    "reliability.graceful-degradation",
    "reliability.bulkheads",
    "frontend.rendering-strategy",
  ],
}

/**
 * Reference solution.
 *
 * Published pages are rendered once and served from the edge, so the crowd never
 * reaches the origin at all. Behind that, a cache with stampede protection, and
 * a read replica so that public reads cannot compete with the editor for the
 * primary. The partition round is survived because the read path can answer from
 * cached state without the store.
 */
export const theViralDeckReference: ArchitectureGraph = {
  components: [
    {
      id: "client",
      kind: "web-client",
      label: "Published page",
      instances: 1,
      region: "global",
      config: {
        vendor: "cf-pages",
        // Pre-rendered: a published page does not need a server to produce it.
        rendering: "static",
        clientRetry: "backoff-jitter",
      },
    },
    {
      id: "cdn",
      kind: "cdn",
      label: "CDN",
      instances: 1,
      region: "global",
      config: { vendor: "cloudfront", availabilityZones: 3, ttlSeconds: 600 },
    },
    {
      id: "lb",
      kind: "load-balancer",
      label: "Load balancer",
      instances: 1,
      region: "us-east-1",
      config: { vendor: "alb", availabilityZones: 3, rateLimitRps: 100 },
    },
    {
      id: "app",
      kind: "app-server",
      label: "Page service",
      instances: 8,
      region: "us-east-1",
      config: {
        vendor: "ecs",
        availabilityZones: 3,
        sessionStore: "none",
      },
    },
    {
      id: "cache",
      kind: "cache",
      label: "Page cache",
      instances: 3,
      region: "us-east-1",
      config: {
        vendor: "elasticache",
        availabilityZones: 3,
        ttlSeconds: 300,
        // Without this, one expiry sends the entire crowd to the origin at once.
        stampedeProtection: true,
      },
    },
    {
      id: "replica",
      kind: "sql-replica",
      label: "Read replica",
      instances: 1,
      region: "us-east-1",
      config: { vendor: "rds", availabilityZones: 2, encryptedAtRest: true },
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
        backups: { enabled: true, rpoMinutes: 10 },
        encryptedAtRest: true,
      },
    },
  ],

  edges: [
    {
      id: "u-client",
      from: CLIENT_NODE_ID,
      to: "client",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "client-cdn",
      from: "client",
      to: "cdn",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "cdn-lb",
      from: "cdn",
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
      timeoutMs: 150,
    },
    {
      // Misses go to the replica, so public reads never compete with the editor
      // for the primary's capacity.
      id: "cache-db",
      from: "cache",
      to: "replica",
      kind: "sync-request",
      carries: "reads",
      timeoutMs: 1_000,
      circuitBreaker: true,
    },
    {
      id: "app-db",
      from: "app",
      to: "db",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 2_000,
      retries: 2,
      jitter: true,
    },
    {
      id: "db-replica",
      from: "db",
      to: "replica",
      kind: "replication",
      replication: { mode: "async", lagMs: 500 },
    },
  ],
}
