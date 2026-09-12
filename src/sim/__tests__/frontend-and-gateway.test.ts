import { describe, expect, it } from "vitest"
import { simulate, SSR_CAPACITY_FACTOR } from "../simulate"
import { gradeAttempt } from "../grade"
import {
  firstRealCustomers as scenario,
  firstRealCustomersReference as reference,
} from "../scenarios/01-first-real-customers"
import {
  CLIENT_NODE_ID,
  type ArchitectureGraph,
  type PlacedComponent,
} from "../types"

const peak = scenario.loadProfiles[2]!
const comp = (
  id: string,
  kind: PlacedComponent["kind"],
  config: PlacedComponent["config"] = {},
): PlacedComponent => ({
  id,
  kind,
  label: id,
  instances: 4,
  region: "eu",
  config: { availabilityZones: 2, ...config },
})

/** Users -> web client -> app -> db */
const withClient = (
  rendering: "static" | "ssr" | "csr",
): ArchitectureGraph => ({
  components: [
    comp("client", "web-client", { rendering }),
    comp("app", "app-server"),
    comp("db", "sql-primary", { backups: { enabled: true, rpoMinutes: 5 } }),
  ],
  edges: [
    {
      id: "u-c",
      from: CLIENT_NODE_ID,
      to: "client",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "c-app",
      from: "client",
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

describe("the web client is not part of your system", () => {
  const r = simulate({
    graph: withClient("csr"),
    load: peak,
    faults: [],
    scenario,
  })

  it("costs nothing -- you do not rent the user's device", () => {
    const bare: ArchitectureGraph = {
      components: withClient("csr").components.filter(
        (c) => c.kind !== "web-client",
      ),
      edges: [
        {
          id: "u-app",
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
      ],
    }
    const without = simulate({ graph: bare, load: peak, faults: [], scenario })
    expect(r.metrics.endToEnd.estimatedMonthlyCostUsd).toBe(
      without.metrics.endToEnd.estimatedMonthlyCostUsd,
    )
  })

  it("does not drag down availability by sitting on the path", () => {
    // Counting a browser in the serial product would say that shipping a web
    // app makes your system less reliable, which is nonsense.
    expect(r.metrics.endToEnd.topologyAvailability).toBeGreaterThan(0.99)
  })

  it("still passes traffic through to the origin", () => {
    expect(
      Math.round(r.metrics.perComponent.app!.offeredReadRps),
    ).toBeGreaterThan(0)
  })
})

describe("rendering strategy moves real numbers", () => {
  it("server rendering halves what each app instance can serve", () => {
    const csr = simulate({
      graph: withClient("csr"),
      load: peak,
      faults: [],
      scenario,
    })
    const ssr = simulate({
      graph: withClient("ssr"),
      load: peak,
      faults: [],
      scenario,
    })
    // Same offered load either way -- conservation is untouched; what changes is
    // how much of the tier that load consumes.
    expect(Math.round(ssr.metrics.perComponent.app!.offeredReadRps)).toBe(
      Math.round(csr.metrics.perComponent.app!.offeredReadRps),
    )
    expect(ssr.metrics.perComponent.app!.utilization).toBeCloseTo(
      csr.metrics.perComponent.app!.utilization / SSR_CAPACITY_FACTOR,
      5,
    )
  })

  it("warns that SSR lands on the app tier", () => {
    const ssr = simulate({
      graph: withClient("ssr"),
      load: peak,
      faults: [],
      scenario,
    })
    expect(ssr.verdicts.map((v) => v.ruleId)).toContain(
      "frontend.ssr-on-app-tier",
    )
  })

  it("calls out static rendering with nothing caching it", () => {
    const s = simulate({
      graph: withClient("static"),
      load: peak,
      faults: [],
      scenario,
    })
    expect(s.verdicts.map((v) => v.ruleId)).toContain(
      "frontend.static-without-cdn",
    )
  })
})

describe("client-side settings that are advice, not arithmetic", () => {
  it("says browser validation is not enforcement", () => {
    const g = withClient("csr")
    g.components[0]!.config.clientValidation = true
    const r = simulate({ graph: g, load: peak, faults: [], scenario })
    const found = r.verdicts.find(
      (v) => v.ruleId === "frontend.client-validation-is-not-enforcement",
    )
    expect(found?.severity).toBe("info") // advice: it must not damage the grade
  })

  it("flags immediate client retries as a synchronised wave", () => {
    const g = withClient("csr")
    g.components[0]!.config.clientRetry = "immediate"
    const r = simulate({ graph: g, load: peak, faults: [], scenario })
    expect(r.verdicts.map((v) => v.ruleId)).toContain(
      "frontend.client-retry-storm",
    )
  })
})

describe("the API gateway", () => {
  it("is flagged as unearned in front of a single service", () => {
    const g: ArchitectureGraph = {
      components: [...reference.components, comp("gw", "api-gateway", {})],
      edges: reference.edges,
    }
    const r = simulate({ graph: g, load: peak, faults: [], scenario })
    expect(r.verdicts.map((v) => v.ruleId)).toContain(
      "api.gateway-over-single-service",
    )
  })

  it("does not break the security probe on a graph that has no gateway", () => {
    // These rules select api-gateway, which did not exist in the catalogue
    // until now; the reference solution has none and must still be gradable.
    const probed = {
      ...scenario,
      faultScript: [
        ...scenario.faultScript,
        [
          { kind: "unauthenticated-probe" as const },
          { kind: "credential-stuffing" as const, rps: 500 },
        ],
      ],
    }
    const graded = gradeAttempt(reference, probed)
    expect(graded.verdicts.map((v) => v.ruleId)).toContain(
      "security.no-rate-limit",
    )
    expect(graded.grade).toBeDefined()
  })
})

describe("the reference solution still passes with the palette grown", () => {
  it("is unaffected by components it does not use", () => {
    const graded = gradeAttempt(reference, scenario)
    expect(graded.requirements.filter((r) => !r.passed)).toEqual([])
  })
})

describe("rules that must not fire on the user's own device", () => {
  it("never calls the web client a single point of failure", () => {
    // There is no second availability zone to put someone's laptop in, so the
    // remediation would be nonsense even if the finding sounded plausible.
    const r = simulate({
      graph: withClient("csr"),
      load: peak,
      faults: [],
      scenario,
    })
    const spof = r.verdicts.filter((v) => v.ruleId === "topology.spof")
    expect(spof.flatMap((v) => v.componentIds)).not.toContain("client")
  })
})
