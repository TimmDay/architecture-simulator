import type { ArchitectureGraph, Scenario } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * Scenario 2 -- the bridge from "keep it up" to "keep it up under load".
 *
 * Level 1 was about redundancy and refusing to gold-plate. This one is about
 * the other half of the same instinct: the answer to a 60x read spike is not
 * sixty times the servers. It is to stop the reads reaching them.
 *
 * The trap is that adding app instances DOES work here, briefly, and then
 * bankrupts you -- the budget is set so that brute force fits the traffic and
 * not the bill. The cheap answer is a CDN in front of content that barely
 * changes, and a cache in front of the reads that remain.
 */
export const frontPage: Scenario = {
  id: "02-front-page",
  title: "The Front Page",
  family: "modular-monolith",
  level: 2,

  brief: `You run a recipe site. It has been quietly profitable for years on one
server and a database, serving maybe 200 people at a time.

This morning one of your recipes reached the front page of a very large
aggregator, and it is now on television. Traffic is sixty times normal, almost
all of it strangers reading one page, and it will stay that way for about two
days before collapsing back to nothing.

The recipes themselves change maybe twice a week. The comments underneath them
change constantly.

You cannot hire anyone, and you cannot spend like a funded startup.`,

  features: ["public-content", "user-accounts"],

  requirements: {
    p99Ms: 400,
    availability: 0.995,
    monthlyBudgetUsd: 450,
    durability: "durable",
    consistency: "eventual", // a comment appearing a few seconds late is fine
  },

  loadProfiles: [
    {
      id: "normal",
      label: "An ordinary Wednesday",
      peakRps: 40,
      readWriteRatio: 20,
      shape: "steady",
      geography: "single-region",
      cacheableReadFraction: 0.85,
    },
    {
      id: "climbing",
      label: "Someone shared it",
      peakRps: 600,
      readWriteRatio: 40,
      shape: "diurnal",
      geography: "single-region",
      cacheableReadFraction: 0.9,
    },
    {
      id: "front-page",
      label: "Front page, and now on television",
      peakRps: 2_400,
      readWriteRatio: 60, // strangers read; almost nobody comments
      shape: "thundering-herd",
      geography: "global",
      cacheableReadFraction: 0.95,
    },
  ],

  faultScript: [
    [{ kind: "node-down", componentId: "app", instances: 1 }],
    // The cache empties -- a deploy, an eviction, a restart -- and every one of
    // those reads arrives at the origin at the same instant.
    [{ kind: "cache-flush", componentId: "cache" }],
  ],

  availableKinds: [
    "web-client",
    "cdn",
    "load-balancer",
    "app-server",
    "cache",
    "sql-primary",
    "sql-replica",
    "object-store",
  ],

  topicIds: [
    "caching.cdn",
    "caching.cache-aside",
    "caching.stampede",
    "caching.ttl-and-staleness",
    "frontend.rendering-strategy",
    "scaling.autoscaling",
    "cost.right-sizing",
    "cost.unit-economics",
    "consistency.eventual",
  ],
}

/**
 * Reference: serve the cacheable mass from the edge, cache what is left, and
 * keep the origin small. $351/mo against a $450 budget -- where scaling the app
 * tier to absorb 2,400 rps unaided would need 12 instances and $472 of app
 * servers alone, before the database.
 */
export const frontPageReference: ArchitectureGraph = {
  components: [
    {
      id: "cdn",
      kind: "cdn",
      label: "CDN",
      instances: 1,
      region: "global",
      config: {
        // CloudFront rather than Cloudflare, deliberately: origin fetches stay
        // inside AWS and pay no egress. Cloudflare in front of AWS is the more
        // popular pairing and works fine -- it just adds a bill for every byte
        // the cache misses, which at this hit rate is about $80/month. That
        // trade is available to the player; the reference simply takes the
        // cheaper side of it.
        vendor: "cloudfront",
        availabilityZones: 2,
        ttlSeconds: 300,
      },
    },
    {
      id: "lb",
      kind: "load-balancer",
      label: "Load balancer",
      instances: 1,
      region: "eu-west-1",
      config: { vendor: "alb", availabilityZones: 2 },
    },
    {
      id: "app",
      kind: "app-server",
      label: "Recipe app",
      instances: 3,
      region: "eu-west-1",
      config: { vendor: "ecs", availabilityZones: 2, sessionStore: "none" },
    },
    {
      id: "cache",
      kind: "cache",
      label: "Page cache",
      instances: 2,
      region: "eu-west-1",
      config: { vendor: "elasticache", availabilityZones: 2, ttlSeconds: 120 },
    },
    {
      id: "db",
      kind: "sql-primary",
      label: "Recipes database",
      instances: 1,
      region: "eu-west-1",
      config: {
        vendor: "rds",
        availabilityZones: 1,
        consistency: "strong",
        // Availability comes from the standby, durability from the backups.
        // Neither substitutes for the other.
        standby: true,
        backups: { enabled: true, rpoMinutes: 15 },
        encryptedAtRest: true,
      },
    },
  ],
  edges: [
    {
      id: "u-cdn",
      from: CLIENT_NODE_ID,
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
      timeoutMs: 200,
    },
    {
      id: "cache-db",
      from: "cache",
      to: "db",
      kind: "sync-request",
      carries: "reads",
      timeoutMs: 2_000,
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
  ],
}
