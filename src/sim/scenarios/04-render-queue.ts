import type { ArchitectureGraph, Scenario } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * Scenario 4 -- asynchronous job processing.
 *
 * The defining constraint of an AI or media product: the work costs seconds of
 * accelerated compute, and the fleet doing it is the largest line on the bill by
 * a wide margin. Everything follows from that. You cannot do it in the request.
 * You cannot afford to do it twice. And you have to be able to scale it without
 * touching the thing that holds the authoritative state.
 *
 * The lesson underneath is the separation of authoritative state from
 * interchangeable compute: the database is the system of record and is hard to
 * scale; the render fleet holds nothing and can be doubled or destroyed at will.
 * Designs that blur the two -- rendering inside the API, or letting workers hold
 * state between jobs -- lose both properties at once.
 */
export const renderQueue: Scenario = {
  id: "04-render-queue",
  title: "The Render Queue",
  family: "event-driven",
  level: 3,

  features: ["user-accounts", "file-uploads", "background-processing"],

  brief: `You work on a design tool. Two of its features are expensive.

"Generate a layout for me" runs a model. "Export as MP4" renders video. Both
take seconds to minutes, both need accelerated hardware, and both are requested
from a web page by someone who is watching a spinner.

The finished files are large and are downloaded far more often than they are
produced. A job that runs twice costs you twice and, for billing, may charge the
customer twice.

Traffic is mostly people browsing and editing. Only a small fraction of requests
actually start a job -- but that fraction is where the money goes.`,

  requirements: {
    // The submit request only. The job itself is allowed to take minutes.
    p99Ms: 300,
    availability: 0.999,
    monthlyBudgetUsd: 9_000,
    durability: "durable",
    consistency: "read-your-writes",
  },

  loadProfiles: [
    {
      id: "weekday",
      label: "A normal weekday",
      peakRps: 200,
      readWriteRatio: 4,
      shape: "diurnal",
      geography: "single-region",
      cacheableReadFraction: 0.4,
    },
    {
      id: "campaign",
      label: "A campaign launches",
      peakRps: 600,
      readWriteRatio: 3,
      shape: "spiky",
      geography: "single-region",
      cacheableReadFraction: 0.35,
    },
    {
      id: "feature-launch",
      label: "The AI feature ships and everyone tries it",
      peakRps: 1_200,
      readWriteRatio: 4, // far more people generating than browsing
      shape: "thundering-herd",
      geography: "global",
      cacheableReadFraction: 0.3,
    },
  ],

  faultScript: [
    [{ kind: "node-down", componentId: "app", instances: 1 }],
    // A worker dies holding a job. Whether that job is lost, duplicated, or
    // resumed is the whole question.
    [{ kind: "node-down", componentId: "render", instances: 2 }],
    // One malformed design that no worker can render.
    [{ kind: "poison-message", componentId: "jobs" }],
  ],

  availableKinds: [
    "web-client",
    "cdn",
    "load-balancer",
    "api-gateway",
    "app-server",
    "queue",
    "worker",
    "gpu-worker",
    "object-store",
    "cache",
    "sql-primary",
    "sql-replica",
  ],

  topicIds: [
    "reliability.state-vs-compute",
    "styles.event-driven",
    "messaging.queue-vs-log",
    "messaging.dlq",
    "messaging.delivery-semantics",
    "messaging.backpressure",
    "transactions.idempotency",
    "scaling.autoscaling",
    "cost.unit-economics",
    "caching.cdn",
  ],
}

/**
 * Reference solution.
 *
 * Submit returns immediately; the fleet does the work; finished files are served
 * from object storage through a CDN rather than through the API. The GPU fleet
 * dominates the bill, which is the honest shape of this kind of product.
 */
export const renderQueueReference: ArchitectureGraph = {
  components: [
    {
      id: "cdn",
      kind: "cdn",
      label: "CDN",
      instances: 1,
      region: "global",
      config: { vendor: "cloudfront", availabilityZones: 2, ttlSeconds: 600 },
    },
    {
      id: "lb",
      kind: "load-balancer",
      label: "Load balancer",
      instances: 1,
      region: "us-east-1",
      config: { vendor: "alb", availabilityZones: 2, rateLimitRps: 40 },
    },
    {
      id: "app",
      kind: "app-server",
      label: "Design API",
      instances: 14,
      region: "us-east-1",
      config: {
        vendor: "ecs",
        availabilityZones: 3,
        sessionStore: "none",
        authRequired: true,
        idempotencyKeys: true,
      },
    },
    {
      id: "jobs",
      kind: "queue",
      label: "Render jobs",
      instances: 1,
      region: "us-east-1",
      config: { vendor: "sqs", availabilityZones: 3, deadLetterQueue: true },
    },
    {
      id: "render",
      kind: "gpu-worker",
      label: "Render fleet",
      instances: 8,
      region: "us-east-1",
      config: {
        vendor: "ec2-gpu",
        availabilityZones: 3,
        // A worker that dies mid-job must not produce a second charge or a
        // second file when the message is redelivered.
        idempotencyKeys: true,
        autoscale: { minInstances: 2, maxInstances: 60 },
      },
    },
    {
      id: "outputs",
      kind: "object-store",
      label: "Rendered files",
      instances: 1,
      region: "us-east-1",
      config: { vendor: "s3", availabilityZones: 3, encryptedAtRest: true },
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
  ],

  edges: [
    {
      id: "u-cdn",
      from: CLIENT_NODE_ID,
      to: "cdn",
      kind: "sync-request",
      carries: "reads",
      fanout: 1,
    },
    {
      id: "u-lb",
      from: CLIENT_NODE_ID,
      to: "lb",
      kind: "sync-request",
      carries: "all",
      fanout: 3,
    },
    {
      id: "cdn-outputs",
      from: "cdn",
      to: "outputs",
      kind: "sync-request",
      carries: "reads",
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
      // Roughly one write in twenty actually starts a render.
      id: "app-jobs",
      from: "app",
      to: "jobs",
      kind: "async-publish",
      carries: "writes",
      fanout: 0.02,
    },
    {
      id: "jobs-render",
      from: "jobs",
      to: "render",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "render-outputs",
      from: "render",
      to: "outputs",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 30_000,
    },
    {
      id: "render-db",
      from: "render",
      to: "db",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 2_000,
      retries: 2,
      jitter: true,
    },
  ],
}
