import { describe, expect, it } from "vitest"
import { layoutGraph, COLUMN_WIDTH } from "../layout"
import { SCENARIOS } from "../scenarios"
import { CLIENT_NODE_ID, type ArchitectureGraph } from "../types"

describe("laying out a reference solution", () => {
  it("places every component, plus the client", () => {
    for (const s of SCENARIOS) {
      const pos = layoutGraph(s.reference)
      expect(pos[CLIENT_NODE_ID], `${s.id}: no client position`).toBeDefined()
      for (const c of s.reference.components) {
        expect(pos[c.id], `${s.id}: ${c.id} unplaced`).toBeDefined()
      }
    }
  })

  it("puts every component to the right of whatever feeds it", () => {
    for (const s of SCENARIOS) {
      const pos = layoutGraph(s.reference)
      for (const e of s.reference.edges) {
        const from = pos[e.from]
        const to = pos[e.to]
        if (!from || !to) continue
        expect(
          to.x,
          `${s.id}: ${e.to} is not right of ${e.from}`,
        ).toBeGreaterThan(from.x)
      }
    }
  })

  it("never stacks two components on the same spot", () => {
    for (const s of SCENARIOS) {
      const pos = layoutGraph(s.reference)
      const seen = new Set<string>()
      for (const [id, p] of Object.entries(pos)) {
        const key = `${p.x},${p.y}`
        expect(seen.has(key), `${s.id}: ${id} overlaps another node`).toBe(
          false,
        )
        seen.add(key)
      }
    }
  })

  it("uses the longest path, so a component reached two ways sits after both", () => {
    // app -> cache -> db, and app -> db directly. The database belongs after
    // the cache, not beside it.
    const g: ArchitectureGraph = {
      components: [
        {
          id: "app",
          kind: "app-server",
          label: "app",
          instances: 1,
          region: "eu",
          config: {},
        },
        {
          id: "cache",
          kind: "cache",
          label: "cache",
          instances: 1,
          region: "eu",
          config: {},
        },
        {
          id: "db",
          kind: "sql-primary",
          label: "db",
          instances: 1,
          region: "eu",
          config: {},
        },
      ],
      edges: [
        { id: "1", from: CLIENT_NODE_ID, to: "app", kind: "sync-request" },
        { id: "2", from: "app", to: "cache", kind: "sync-request" },
        { id: "3", from: "cache", to: "db", kind: "sync-request" },
        { id: "4", from: "app", to: "db", kind: "sync-request" },
      ],
    }
    const pos = layoutGraph(g)
    expect(pos.db!.x).toBe(pos.cache!.x + COLUMN_WIDTH)
  })

  it("terminates on a graph with a cycle", () => {
    const g: ArchitectureGraph = {
      components: [
        {
          id: "a",
          kind: "app-server",
          label: "a",
          instances: 1,
          region: "eu",
          config: {},
        },
        {
          id: "b",
          kind: "app-server",
          label: "b",
          instances: 1,
          region: "eu",
          config: {},
        },
      ],
      edges: [
        { id: "1", from: CLIENT_NODE_ID, to: "a", kind: "sync-request" },
        { id: "2", from: "a", to: "b", kind: "sync-request" },
        { id: "3", from: "b", to: "a", kind: "sync-request" },
      ],
    }
    expect(() => layoutGraph(g)).not.toThrow()
  })
})
