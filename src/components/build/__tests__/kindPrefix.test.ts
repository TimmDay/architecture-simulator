import { describe, expect, it } from "vitest"
import { kindPrefixFor } from "../ComponentNode"
import { SCENARIOS } from "~/sim/scenarios"
import { CATALOGUE } from "~/sim/catalogue"
import type { ComponentKind, PlacedComponent } from "~/sim/types"

const at = (kind: ComponentKind, label: string): PlacedComponent => ({
  id: "x",
  kind,
  label,
  instances: 1,
  region: "eu",
  config: {},
})

describe("labelling a component with its kind", () => {
  it("prefixes a name that does not say what the thing is", () => {
    expect(kindPrefixFor(at("queue", "Render jobs"))).toBe("Queue")
    expect(kindPrefixFor(at("app-server", "Design API"))).toBe("App server")
    expect(kindPrefixFor(at("gpu-worker", "Render fleet"))).toBe("GPU worker")
    expect(kindPrefixFor(at("sql-primary", "Tickets database"))).toBe(
      "SQL primary",
    )
    expect(kindPrefixFor(at("log-stream", "design.updated"))).toBe("Event log")
  })

  it("stays quiet when the name already says it", () => {
    // "Cache: Page cache" teaches nothing and is noise on the canvas.
    expect(kindPrefixFor(at("cache", "Page cache"))).toBeNull()
    expect(
      kindPrefixFor(at("load-balancer", "Public load balancer")),
    ).toBeNull()
    expect(kindPrefixFor(at("load-balancer", "Load balancer"))).toBeNull()
    expect(kindPrefixFor(at("search-index", "Search index"))).toBeNull()
  })

  it("keeps every prefix short enough to sit in front of a name", () => {
    for (const spec of Object.values(CATALOGUE)) {
      if (!spec) continue
      expect(
        spec.shortName.length,
        `${spec.kind} prefix is too long`,
      ).toBeLessThan(20)
      expect(spec.shortName).not.toContain("/")
      expect(spec.shortName).not.toContain("(")
    }
  })

  it("produces a readable title for every component in every reference solution", () => {
    for (const scenario of SCENARIOS) {
      for (const component of scenario.reference.components) {
        const prefix = kindPrefixFor(component)
        const title = prefix ? `${prefix}: ${component.label}` : component.label
        expect(
          title.length,
          `${scenario.id}/${component.id}: "${title}"`,
        ).toBeLessThan(46)
        // Never "Queue: Queue" or similar.
        expect(title.toLowerCase()).not.toMatch(/^(.+): \1$/)
      }
    }
  })
})
