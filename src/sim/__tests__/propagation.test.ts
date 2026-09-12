import { describe, expect, it } from "vitest"
import { simulate } from "../simulate"
import { firstRealCustomers as scenario } from "../scenarios/01-first-real-customers"
import {
  CLIENT_NODE_ID,
  type ArchitectureGraph,
  type PlacedComponent,
} from "../types"

const peak = scenario.loadProfiles[2]! // 400 rps, 5:1 reads:writes
const c = (id: string, kind: PlacedComponent["kind"]): PlacedComponent => ({
  id,
  kind,
  label: id,
  instances: 4,
  region: "eu",
  config: { availabilityZones: 2 },
})
const offered = (r: ReturnType<typeof simulate>, id: string) => {
  const m = r.metrics.perComponent[id]
  return Math.round((m?.offeredReadRps ?? 0) + (m?.offeredWriteRps ?? 0))
}

describe("a router divides traffic", () => {
  it("splits evenly between two app servers instead of cloning it", () => {
    const graph: ArchitectureGraph = {
      components: [
        c("lb", "load-balancer"),
        c("a1", "app-server"),
        c("a2", "app-server"),
      ],
      edges: [
        {
          id: "c-lb",
          from: CLIENT_NODE_ID,
          to: "lb",
          kind: "sync-request",
          carries: "all",
        },
        {
          id: "lb-a1",
          from: "lb",
          to: "a1",
          kind: "sync-request",
          carries: "all",
        },
        {
          id: "lb-a2",
          from: "lb",
          to: "a2",
          kind: "sync-request",
          carries: "all",
        },
      ],
    }
    const r = simulate({ graph, load: peak, faults: [], scenario })
    expect(offered(r, "lb")).toBe(400)
    expect(offered(r, "a1")).toBe(200)
    expect(offered(r, "a2")).toBe(200)
    // Conservation: a load balancer must not manufacture requests.
    expect(offered(r, "a1") + offered(r, "a2")).toBe(offered(r, "lb"))
  })
})

describe("a caller duplicates traffic", () => {
  it("sends the full request flow to every dependency it calls", () => {
    const graph: ArchitectureGraph = {
      components: [
        c("app", "app-server"),
        c("db", "sql-primary"),
        c("cache", "cache"),
      ],
      edges: [
        {
          id: "c-app",
          from: CLIENT_NODE_ID,
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
        },
        {
          id: "app-cache",
          from: "app",
          to: "cache",
          kind: "sync-request",
          carries: "reads",
        },
      ],
    }
    const r = simulate({ graph, load: peak, faults: [], scenario })
    expect(offered(r, "app")).toBe(400)
    // Each inbound request hits the database; this is a call, not a split.
    expect(offered(r, "db")).toBe(400)
    expect(offered(r, "cache")).toBe(333) // reads only
  })

  it("multiplies by fanout, which is what makes N+1 visible", () => {
    const graph: ArchitectureGraph = {
      components: [c("app", "app-server"), c("db", "sql-primary")],
      edges: [
        {
          id: "c-app",
          from: CLIENT_NODE_ID,
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
          fanout: 10,
        },
      ],
    }
    const r = simulate({ graph, load: peak, faults: [], scenario })
    expect(offered(r, "db")).toBe(4000)
  })
})

describe("splitting reads from writes", () => {
  it("keeps all writes on the primary while reads go to a replica", () => {
    const graph: ArchitectureGraph = {
      components: [
        c("app", "app-server"),
        c("db", "sql-primary"),
        c("replica", "sql-replica"),
      ],
      edges: [
        {
          id: "c-app",
          from: CLIENT_NODE_ID,
          to: "app",
          kind: "sync-request",
          carries: "all",
        },
        {
          id: "app-db",
          from: "app",
          to: "db",
          kind: "sync-request",
          carries: "writes",
        },
        {
          id: "app-rep",
          from: "app",
          to: "replica",
          kind: "sync-request",
          carries: "reads",
        },
      ],
    }
    const r = simulate({ graph, load: peak, faults: [], scenario })
    const db = r.metrics.perComponent.db!
    const rep = r.metrics.perComponent.replica!
    // 400 rps at 5:1 -> 333 reads, 67 writes. No write may be lost to the
    // read-only edge, and no read may land on the write-only one.
    expect(Math.round(db.offeredWriteRps)).toBe(67)
    expect(Math.round(db.offeredReadRps)).toBe(0)
    expect(Math.round(rep.offeredReadRps)).toBe(333)
    expect(Math.round(rep.offeredWriteRps)).toBe(0)
  })
})

describe("a cache passes only its misses onward", () => {
  it("shields the database in proportion to the hit ratio", () => {
    const graph: ArchitectureGraph = {
      components: [
        c("app", "app-server"),
        { ...c("cache", "cache"), config: { ttlSeconds: 300 } },
        c("db", "sql-primary"),
      ],
      edges: [
        {
          id: "c-app",
          from: CLIENT_NODE_ID,
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
        },
        {
          id: "cache-db",
          from: "cache",
          to: "db",
          kind: "sync-request",
          carries: "reads",
        },
      ],
    }
    const r = simulate({ graph, load: peak, faults: [], scenario })
    const cache = r.metrics.perComponent.cache!
    const db = r.metrics.perComponent.db!
    expect(Math.round(cache.offeredReadRps)).toBe(333)
    // Fewer reads reach the store than reached the cache.
    expect(db.offeredReadRps).toBeLessThan(cache.offeredReadRps)
    expect(db.offeredReadRps).toBeGreaterThan(0)
  })
})
