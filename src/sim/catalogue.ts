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
    managed: true,
    optionalOnPath: false,
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
    managed: true,
    optionalOnPath: true,
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
    managed: true,
    optionalOnPath: true,
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
    capacity: { readRps: 100_000, writeRps: 0 },
    baseLatency: { p50Ms: 15, p99Ms: 40 },
    baselineAvailability: 0.9999,
    stateful: false,
    durable: false,
    managed: true,
    optionalOnPath: true,
    costPerInstanceHourUsd: 0.015, // ~$11/mo at this scale
    failureModes: [],
    supports: { replicas: false, consistencyModes: ["eventual"] },
  },
}

export function monthlyCostUsd(spec: ComponentSpec, instances: number): number {
  return spec.costPerInstanceHourUsd * HOURS_PER_MONTH * instances
}
