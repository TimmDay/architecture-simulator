import { describe, expect, it } from "vitest"
import {
  simulate,
  EGRESS_USD_PER_RPS_MONTH,
  crossesVendors,
  vendorFamily,
} from "../simulate"
import { CATALOGUE } from "../catalogue"
import { receiptsAndPayments } from "../scenarios/03-receipts-and-payments"
import { frontPage } from "../scenarios/02-front-page"
import {
  CLIENT_NODE_ID,
  type ArchitectureGraph,
  type PlacedComponent,
} from "../types"

const peak = frontPage.loadProfiles[2]!

const c = (
  id: string,
  kind: PlacedComponent["kind"],
  vendor: string | undefined,
  extra: PlacedComponent["config"] = {},
): PlacedComponent => ({
  id,
  kind,
  label: id,
  instances: 8,
  region: "eu",
  config: { availabilityZones: 2, vendor, ...extra },
})

const chain = (
  appVendor: string,
  dbVendor: string | undefined,
): ArchitectureGraph => ({
  components: [
    c("lb", "load-balancer", "alb"),
    c("app", "app-server", appVendor),
    c("db", "sql-primary", dbVendor, {
      backups: { enabled: true, rpoMinutes: 5 },
    }),
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
    },
  ],
})

describe("vendor catalogue", () => {
  it("offers real products for every component you actually buy", () => {
    for (const [kind, spec] of Object.entries(CATALOGUE)) {
      if (!spec || spec.clientSide) continue
      expect(spec.vendors.length, `${kind} offers no vendors`).toBeGreaterThan(
        0,
      )
    }
  })

  it("gives every option a resolvable family", () => {
    for (const spec of Object.values(CATALOGUE)) {
      for (const vendor of spec?.vendors ?? []) {
        expect(vendor.family).toBeTruthy()
        expect(vendor.id).toBeTruthy()
      }
    }
  })
})

describe("crossing a provider boundary", () => {
  const same = chain("ecs", "rds")
  const split = chain("ecs", "cloud-sql")

  it("is detected only when both sides have a vendor and they differ", () => {
    expect(crossesVendors(same, same.edges[2]!)).toBe(false)
    expect(crossesVendors(split, split.edges[2]!)).toBe(true)
    const undecided = chain("ecs", undefined)
    // Undecided means unanswered. Charging for it would invent a cost the
    // player never chose.
    expect(crossesVendors(undecided, undecided.edges[2]!)).toBe(false)
  })

  it("costs egress in proportion to what crosses it", () => {
    const a = simulate({
      graph: same,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    const b = simulate({
      graph: split,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    const extra =
      b.metrics.endToEnd.estimatedMonthlyCostUsd -
      a.metrics.endToEnd.estimatedMonthlyCostUsd
    const dbFlow = b.metrics.perComponent.db!
    expect(extra).toBeCloseTo(
      (dbFlow.offeredReadRps + dbFlow.offeredWriteRps) *
        EGRESS_USD_PER_RPS_MONTH,
      1,
    )
    expect(extra).toBeGreaterThan(0)
  })

  it("adds real network latency", () => {
    const a = simulate({
      graph: same,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    const b = simulate({
      graph: split,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    expect(b.metrics.endToEnd.p99Ms).toBeGreaterThan(a.metrics.endToEnd.p99Ms)
  })

  it("raises the egress finding when the link is hot", () => {
    const r = simulate({
      graph: split,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    expect(r.verdicts.map((v) => v.ruleId)).toContain(
      "cost.cross-vendor-egress",
    )
  })
})

describe("vendor findings are opinionated in the right direction", () => {
  it("notes single-vendor concentration without demanding a second cloud", () => {
    const single: ArchitectureGraph = {
      components: [
        c("lb", "load-balancer", "alb"),
        c("app", "app-server", "ecs"),
        c("cache", "cache", "elasticache"),
        c("db", "sql-primary", "rds", {
          backups: { enabled: true, rpoMinutes: 5 },
        }),
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
        },
        {
          id: "app-db",
          from: "app",
          to: "db",
          kind: "sync-request",
          carries: "all",
        },
      ],
    }
    const r = simulate({
      graph: single,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    const found = r.verdicts.find(
      (v) => v.ruleId === "org.vendor-concentration",
    )
    expect(found).toBeDefined()
    // Advisory, not a failure: one provider is usually the right call.
    expect(found?.severity).toBe("info")
    expect(found?.remediationHint).not.toMatch(/second cloud|multi-cloud/i)
  })

  it("warns about three-way infrastructure sprawl rather than rewarding it", () => {
    const sprawl: ArchitectureGraph = {
      components: [
        c("lb", "load-balancer", "alb"),
        c("app", "app-server", "cloud-run"),
        c("cache", "cache", "azure-redis"),
        c("db", "sql-primary", "rds", {
          backups: { enabled: true, rpoMinutes: 5 },
        }),
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
        },
        {
          id: "app-db",
          from: "app",
          to: "db",
          kind: "sync-request",
          carries: "all",
        },
      ],
    }
    const r = simulate({
      graph: sprawl,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    expect(r.verdicts.map((v) => v.ruleId)).toContain(
      "operability.multi-vendor-complexity",
    )
  })

  it("does not scold a small system for using one provider", () => {
    // Concentration only matters once an exit would be a project.
    const tiny = { ...frontPage, loadProfiles: [{ ...peak, peakRps: 50 }] }
    const single = chain("ecs", "rds")
    const r = simulate({
      graph: single,
      load: tiny.loadProfiles[0]!,
      faults: [],
      scenario: tiny,
    })
    expect(r.verdicts.map((v) => v.ruleId)).not.toContain(
      "org.vendor-concentration",
    )
  })

  it("flags the operational burden of self-hosting a stateful service", () => {
    const selfHosted = chain("ecs", "pg-self")
    const r = simulate({
      graph: selfHosted,
      load: peak,
      faults: [],
      scenario: frontPage,
    })
    expect(r.verdicts.map((v) => v.ruleId)).toContain(
      "operability.self-hosted-burden",
    )
  })
})

describe("scenario references name real products", () => {
  it("so the diagram reads like a design review", () => {
    for (const c of receiptsAndPayments.availableKinds) {
      const spec = CATALOGUE[c]
      if (spec && !spec.clientSide)
        expect(spec.vendors.length).toBeGreaterThan(0)
    }
    expect(vendorFamily({ ...chain("ecs", "rds").components[1]! })).toBe("aws")
  })
})
