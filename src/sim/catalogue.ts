import type { ComponentKind, ComponentSpec } from "./types"

/**
 * Component catalogue.
 *
 * These numbers are global -- every scenario is graded against the same physics.
 * They are therefore never tuned to make an individual scenario winnable; if a
 * scenario is unwinnable, the scenario is wrong, not the catalogue.
 *
 * Figures are deliberately round and are meant to be *defensible*, not exact:
 * roughly a small managed instance of each thing on a major cloud, circa now.
 * `baselineAvailability` is the availability of ONE instance in ONE failure
 * domain.
 */

export const HOURS_PER_MONTH = 730

export const CATALOGUE: Partial<Record<ComponentKind, ComponentSpec>> = {
  "load-balancer": {
    kind: "load-balancer",
    label: "Load balancer (L7)",
    capacity: { readRps: 10_000, writeRps: 10_000 },
    baseLatency: { p50Ms: 2, p99Ms: 8 },
    baselineAvailability: 0.9995,
    stateful: false,
    durable: false,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    routesTraffic: true,
    costPerInstanceHourUsd: 0.025, // ~$18/mo
    failureModes: ["az-loss", "region-loss"],
    supports: { replicas: false },
  },

  "app-server": {
    kind: "app-server",
    label: "App server",
    capacity: { readRps: 200, writeRps: 200 },
    baseLatency: { p50Ms: 25, p99Ms: 80 },
    baselineAvailability: 0.99,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.04, // ~$29/mo
    failureModes: ["process-crash", "az-loss", "connection-exhaustion"],
    supports: { replicas: false, autoscale: true, sessionStore: true },
  },

  "sql-primary": {
    kind: "sql-primary",
    label: "SQL primary",
    // Writes cost ~5x a read: durability, WAL, index maintenance.
    capacity: { readRps: 2_000, writeRps: 400 },
    baseLatency: { p50Ms: 5, p99Ms: 25 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: true,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.17, // ~$124/mo
    failureModes: ["disk-failure", "az-loss", "connection-exhaustion"],
    supports: {
      replicas: true,
      consistencyModes: ["strong"],
      encryptionAtRest: true,
      backups: true,
    },
  },

  "sql-replica": {
    kind: "sql-replica",
    label: "SQL read replica",
    // writeRps 0 is the point: routing writes here is a mistake the engine can see.
    capacity: { readRps: 2_000, writeRps: 0 },
    baseLatency: { p50Ms: 5, p99Ms: 25 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: true,
    managed: false,
    optionalOnPath: true,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.17, // ~$124/mo
    failureModes: ["disk-failure", "az-loss", "replication-stall"],
    supports: {
      replicas: false,
      consistencyModes: ["eventual"],
      encryptionAtRest: true,
    },
  },

  cache: {
    kind: "cache",
    label: "In-memory cache",
    capacity: { readRps: 50_000, writeRps: 50_000 },
    baseLatency: { p50Ms: 1, p99Ms: 3 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: false,
    managed: false,
    optionalOnPath: true,
    clientSide: false,
    caches: true,
    canAddRedundancy: true,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.03, // ~$22/mo
    failureModes: ["process-crash", "az-loss", "cache-eviction-storm"],
    supports: {
      replicas: true,
      consistencyModes: ["eventual"],
      sessionStore: true,
    },
  },

  cdn: {
    kind: "cdn",
    label: "CDN",
    // Writes are proxied straight through, not cached. A real CDN passes a POST
    // to the origin without complaint, so refusing them here would invent a
    // mistake that does not exist.
    capacity: { readRps: 100_000, writeRps: 50_000 },
    baseLatency: { p50Ms: 15, p99Ms: 40 },
    baselineAvailability: 0.9999,
    stateful: false,
    durable: false,
    managed: true,
    optionalOnPath: true,
    clientSide: false,
    caches: true,
    canAddRedundancy: true,
    routesTraffic: true,
    costPerInstanceHourUsd: 0.015, // ~$11/mo at this scale
    failureModes: [],
    supports: { replicas: false, consistencyModes: ["eventual"] },
  },

  "api-gateway": {
    kind: "api-gateway",
    label: "API gateway",
    capacity: { readRps: 5_000, writeRps: 5_000 },
    baseLatency: { p50Ms: 4, p99Ms: 15 },
    baselineAvailability: 0.9995,
    stateful: false,
    durable: false,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    routesTraffic: true,
    costPerInstanceHourUsd: 0.045, // ~$33/mo
    failureModes: ["az-loss", "region-loss"],
    supports: { replicas: false },
  },

  queue: {
    kind: "queue",
    label: "Queue",
    capacity: { readRps: 10_000, writeRps: 10_000 },
    baseLatency: { p50Ms: 5, p99Ms: 20 },
    baselineAvailability: 0.9999,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    // Competing consumers: messages are divided between them, not copied.
    routesTraffic: true,
    costPerInstanceHourUsd: 0.02, // ~$15/mo
    failureModes: ["az-loss"],
    supports: { replicas: false },
  },

  worker: {
    kind: "worker",
    label: "Worker",
    // Background compute -- image processing, OCR, thumbnailing. Far more
    // expensive per item than serving a web request, which is the whole reason
    // it belongs off the request path.
    capacity: { readRps: 40, writeRps: 40 },
    baseLatency: { p50Ms: 400, p99Ms: 1_500 },
    baselineAvailability: 0.99,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.08, // ~$58/mo
    failureModes: ["process-crash", "az-loss"],
    supports: { replicas: false, autoscale: true },
  },

  "object-store": {
    kind: "object-store",
    label: "Object store",
    capacity: { readRps: 5_000, writeRps: 1_000 },
    baseLatency: { p50Ms: 25, p99Ms: 90 },
    baselineAvailability: 0.9999,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.03, // ~$22/mo at this volume
    failureModes: ["region-loss"],
    supports: { replicas: false, encryptionAtRest: true },
  },

  "third-party-api": {
    kind: "third-party-api",
    label: "Third-party API",
    // Someone else's system. You cannot add instances, you cannot tune it, and
    // its availability is a ceiling on yours wherever it sits on the synchronous
    // path. The latency is theirs too -- note the p99.
    capacity: { readRps: 500, writeRps: 500 },
    baseLatency: { p50Ms: 120, p99Ms: 600 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: false,
    routesTraffic: false,
    costPerInstanceHourUsd: 0, // billed per transaction, not per hour
    failureModes: ["region-loss"],
    supports: { replicas: false },
  },

  "web-client": {
    kind: "web-client",
    label: "Web client",
    // Runs in the user's browser, so there is no server capacity to exhaust.
    capacity: {
      readRps: Number.MAX_SAFE_INTEGER,
      writeRps: Number.MAX_SAFE_INTEGER,
    },
    baseLatency: { p50Ms: 0, p99Ms: 0 },
    baselineAvailability: 1,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: true,
    caches: false,
    canAddRedundancy: false,
    routesTraffic: true,
    costPerInstanceHourUsd: 0,
    failureModes: [],
    supports: { replicas: false },
  },
}

export function monthlyCostUsd(spec: ComponentSpec, instances: number): number {
  return spec.costPerInstanceHourUsd * HOURS_PER_MONTH * instances
}
