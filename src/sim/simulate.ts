import { CATALOGUE, HOURS_PER_MONTH } from "./catalogue"
import type {
  ArchitectureGraph,
  ComponentSpec,
  ComponentMetrics,
  Edge,
  FaultEvent,
  LoadProfile,
  PlacedComponent,
  SimulateInput,
  SimulationResult,
} from "./types"
import { CLIENT_NODE_ID } from "./types"
import { runRules } from "./rules"

/** The 1/(1-rho) heuristic is clamped here. See SPEC.md -- it is a game curve, not queueing theory. */
export const LATENCY_INFLATION_CAP = 20
/** Above this utilization the capacity rule complains, well before rho hits 1. */
export const SATURATION_WARN = 0.8

export type EffectiveComponent = PlacedComponent & {
  aliveInstances: number
  /** Independent failure domains actually available: min(alive, zones). */
  domains: number
}

/** Apply one round of faults, producing the component set the round actually runs against. */
export function applyFaults(
  graph: ArchitectureGraph,
  faults: FaultEvent[],
): { components: EffectiveComponent[]; partitionedEdgeIds: Set<string> } {
  const partitionedEdgeIds = new Set<string>()

  const components = graph.components.map((c): EffectiveComponent => {
    let alive = c.instances
    const zones = c.config.availabilityZones ?? 1

    for (const f of faults) {
      switch (f.kind) {
        case "node-down":
          if (f.componentId === c.id) alive -= f.instances ?? 1
          break
        case "az-down": {
          if (f.componentId !== c.id) break
          // Instances are distributed round-robin, so a zone holds ceil or floor
          // of instances/zones depending on where it sits in the rotation.
          const inZone =
            Math.floor(c.instances / zones) +
            (f.zone < c.instances % zones ? 1 : 0)
          alive -= inZone
          break
        }
        case "region-down":
          if (f.region === c.region) alive = 0
          break
        default:
          break
      }
    }

    for (const f of faults) {
      if (f.kind === "network-partition") partitionedEdgeIds.add(f.edgeId)
    }

    alive = Math.max(0, alive)
    return { ...c, aliveInstances: alive, domains: Math.min(alive, zones) }
  })

  return { components, partitionedEdgeIds }
}

/**
 * Cache hit ratio, derived rather than declared.
 *
 * The player never sets this -- a player-declared 99% would be free marks. It
 * comes from how much of the workload is cacheable at all (a property of the
 * scenario), how long entries live, and the traffic shape: a spiky or
 * thundering-herd profile arrives faster than a cache can warm, so the effective
 * ratio is worse than the steady-state one.
 */
export function cacheHitRatio(
  component: PlacedComponent,
  load: LoadProfile,
): number {
  const ttl = component.config.ttlSeconds ?? 60
  const ttlFactor = Math.min(1, ttl / 60)
  const shapePenalty =
    load.shape === "thundering-herd" ? 0.5 : load.shape === "spiky" ? 0.75 : 1
  return load.cacheableReadFraction * ttlFactor * shapePenalty
}

type Flow = { reads: number; writes: number }

/**
 * Propagate offered load from the implicit client node through the graph.
 *
 * Three branch semantics, which is the thing that makes this more than summing
 * boxes:
 *   - distribution: a single downstream target receives the whole flow (a load
 *     balancer spreads across the INSTANCES of its target, not across targets).
 *   - fanout: several sync targets each receive the full flow, times the edge's
 *     `fanout`. This is what makes N+1 measurable.
 *   - sequential fallback: a cache passes only its MISSES to whatever sits
 *     behind it, which is why the cache's backing store is drawn as an edge from
 *     the cache rather than as a sibling hanging off the app.
 */
export function propagate(
  components: EffectiveComponent[],
  edges: Edge[],
  load: LoadProfile,
  partitionedEdgeIds: Set<string>,
): Map<string, Flow> {
  const byId = new Map(components.map((c) => [c.id, c]))
  const flows = new Map<string, Flow>()
  for (const c of components) flows.set(c.id, { reads: 0, writes: 0 })

  const totalReads =
    (load.peakRps * load.readWriteRatio) / (load.readWriteRatio + 1)
  const totalWrites = load.peakRps / (load.readWriteRatio + 1)

  const live = edges.filter(
    (e) =>
      !partitionedEdgeIds.has(e.id) &&
      e.kind !== "replication" &&
      e.kind !== "cdc",
  )

  // Seed from the client's outgoing edges.
  const queue: { id: string; flow: Flow }[] = []
  for (const e of live.filter((e) => e.from === CLIENT_NODE_ID)) {
    queue.push({ id: e.to, flow: { reads: totalReads, writes: totalWrites } })
  }

  const guard = new Map<string, number>()
  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    const { id, flow } = next
    const component = byId.get(id)
    if (!component) continue

    // Cycle guard: a graph with a loop would otherwise spin forever.
    const visits = (guard.get(id) ?? 0) + 1
    guard.set(id, visits)
    if (visits > components.length + 1) continue

    const acc = flows.get(id)
    if (!acc) continue
    acc.reads += flow.reads
    acc.writes += flow.writes

    // What leaves this component.
    let outReads = flow.reads
    const outWrites = flow.writes
    if (component.kind === "cache") {
      // Sequential fallback: only misses continue downstream.
      outReads = flow.reads * (1 - cacheHitRatio(component, load))
    }

    for (const e of live.filter((e) => e.from === id)) {
      const fanout = e.fanout ?? 1
      const carries = e.carries ?? "all"
      const reads = carries === "writes" ? 0 : outReads * fanout
      const writes = carries === "reads" ? 0 : outWrites * fanout
      if (reads > 0 || writes > 0)
        queue.push({ id: e.to, flow: { reads, writes } })
    }
  }

  return flows
}

function metricsFor(
  component: EffectiveComponent,
  flow: Flow,
): ComponentMetrics {
  const spec = CATALOGUE[component.kind]
  if (!spec) {
    return {
      offeredReadRps: flow.reads,
      offeredWriteRps: flow.writes,
      utilization: 0,
      queueDepthApprox: 0,
      p50Ms: 0,
      p99Ms: 0,
      droppedRps: 0,
    }
  }

  const alive = component.aliveInstances
  if (alive === 0) {
    return {
      offeredReadRps: flow.reads,
      offeredWriteRps: flow.writes,
      utilization: Infinity,
      queueDepthApprox: Infinity,
      p50Ms: 0,
      p99Ms: 0,
      droppedRps: flow.reads + flow.writes,
    }
  }

  const readCap = spec.capacity.readRps * alive
  const writeCap = spec.capacity.writeRps * alive
  const rhoRead =
    readCap === 0 ? (flow.reads > 0 ? Infinity : 0) : flow.reads / readCap
  // writeCap 0 with writes offered means writes were routed somewhere that
  // cannot accept them -- a read replica. Infinite utilization is the signal.
  const rhoWrite =
    writeCap === 0 ? (flow.writes > 0 ? Infinity : 0) : flow.writes / writeCap
  const utilization = Math.max(rhoRead, rhoWrite)

  const inflation =
    utilization >= 1
      ? LATENCY_INFLATION_CAP
      : Math.min(LATENCY_INFLATION_CAP, 1 / (1 - utilization))

  const offered = flow.reads + flow.writes
  const capacity = Math.min(readCap + writeCap, Number.MAX_SAFE_INTEGER)

  return {
    offeredReadRps: flow.reads,
    offeredWriteRps: flow.writes,
    utilization,
    queueDepthApprox:
      utilization >= 1
        ? Infinity
        : (utilization * utilization) / (1 - utilization),
    p50Ms: spec.baseLatency.p50Ms * inflation,
    p99Ms: spec.baseLatency.p99Ms * inflation,
    droppedRps: utilization >= 1 ? Math.max(0, offered - capacity) : 0,
  }
}

/** Longest latency path from the client, which is what the user actually waits for. */
function criticalPath(
  components: EffectiveComponent[],
  edges: Edge[],
  perComponent: Record<string, ComponentMetrics>,
  partitionedEdgeIds: Set<string>,
): { p50Ms: number; p99Ms: number } {
  const live = edges.filter(
    (e) => !partitionedEdgeIds.has(e.id) && e.kind === "sync-request",
  )
  const ids = new Set(components.map((c) => c.id))
  let best = { p50Ms: 0, p99Ms: 0 }

  const walk = (
    id: string,
    acc: { p50Ms: number; p99Ms: number },
    depth: number,
  ) => {
    if (depth > 32) return
    const m = perComponent[id]
    const here = m
      ? { p50Ms: acc.p50Ms + m.p50Ms, p99Ms: acc.p99Ms + m.p99Ms }
      : acc
    if (here.p99Ms > best.p99Ms) best = here
    for (const e of live.filter((e) => e.from === id)) {
      if (ids.has(e.to)) walk(e.to, here, depth + 1)
    }
  }

  for (const e of live.filter((e) => e.from === CLIENT_NODE_ID))
    walk(e.to, { p50Ms: 0, p99Ms: 0 }, 0)
  return best
}

/**
 * Topology availability: P(the system is up), composed across independent
 * failure domains and multiplied along the serial path.
 *
 * This is a property of the graph, not of the fault round -- the same number
 * with or without a fault applied. Whether a specific fault breaks the system is
 * a separate, binary question, answered by errorRate in that round.
 */
export function topologyAvailability(
  components: EffectiveComponent[],
  edges: Edge[],
): number {
  const reachable = new Set<string>()
  const live = edges.filter((e) => e.kind === "sync-request")
  const walk = (id: string, depth: number) => {
    if (depth > 32 || reachable.has(id)) return
    reachable.add(id)
    for (const e of live.filter((e) => e.from === id)) walk(e.to, depth + 1)
  }
  for (const e of live.filter((e) => e.from === CLIENT_NODE_ID)) walk(e.to, 0)

  let availability = 1
  for (const c of components) {
    if (!reachable.has(c.id)) continue
    const spec = CATALOGUE[c.kind]
    if (!spec) continue
    if (isOptionalOnPath(c, spec)) continue
    availability *=
      1 - Math.pow(1 - spec.baselineAvailability, failureDomains(c, spec))
  }
  return availability
}

/**
 * How many INDEPENDENT failure domains this component actually occupies.
 *
 * For self-run components, one instance sits in one zone however many zones you
 * nominally spread across -- so `min(instances, zones)`. For managed services
 * bought as a single logical unit, the provider runs the redundancy and the
 * zone count stands on its own.
 */
export function failureDomains(
  c: PlacedComponent,
  spec: ComponentSpec,
): number {
  const zones = c.config.availabilityZones ?? 1
  return Math.max(1, spec.managed ? zones : Math.min(c.instances, zones))
}

/** Would losing this component degrade the system, or break it? */
export function isOptionalOnPath(
  c: PlacedComponent,
  spec: ComponentSpec,
): boolean {
  // A cache is normally a fallback path -- unless it is holding the sessions,
  // in which case losing it logs everybody out and it is squarely required.
  if (c.kind === "cache" && c.config.sessionStore === "shared") return false
  return spec.optionalOnPath
}

export function monthlyCost(graph: ArchitectureGraph): number {
  return graph.components.reduce((sum, c) => {
    const spec = CATALOGUE[c.kind]
    return spec
      ? sum + spec.costPerInstanceHourUsd * HOURS_PER_MONTH * c.instances
      : sum
  }, 0)
}

/** Worst staleness a read can observe: async replication lag plus cache TTL. */
export function staleReadWindowMs(graph: ArchitectureGraph): number {
  let worst = 0
  for (const e of graph.edges) {
    if (e.kind === "replication" && e.replication?.mode === "async") {
      worst = Math.max(worst, e.replication.lagMs)
    }
  }
  for (const c of graph.components) {
    if (c.kind === "cache" && c.config.ttlSeconds) {
      worst = Math.max(worst, c.config.ttlSeconds * 1000)
    }
  }
  return worst
}

/**
 * The whole engine. Pure, deterministic, no React and no I/O -- everything the
 * UI shows is a render of this.
 */
export function simulate(input: SimulateInput): SimulationResult {
  const { graph, load, faults, scenario } = input
  const { components, partitionedEdgeIds } = applyFaults(graph, faults)
  const flows = propagate(components, graph.edges, load, partitionedEdgeIds)

  const perComponent: Record<string, ComponentMetrics> = {}
  for (const c of components) {
    perComponent[c.id] = metricsFor(
      c,
      flows.get(c.id) ?? { reads: 0, writes: 0 },
    )
  }

  const path = criticalPath(
    components,
    graph.edges,
    perComponent,
    partitionedEdgeIds,
  )

  const offered = load.peakRps
  const dropped = Object.values(perComponent).reduce(
    (s, m) => s + (Number.isFinite(m.droppedRps) ? m.droppedRps : 0),
    0,
  )
  const deadOnPath = components.some(
    (c) =>
      c.aliveInstances === 0 &&
      (flows.get(c.id)?.reads ?? 0) + (flows.get(c.id)?.writes ?? 0) > 0,
  )
  const errorRate = deadOnPath ? 1 : Math.min(1, dropped / Math.max(1, offered))

  const result: SimulationResult = {
    metrics: {
      perComponent,
      endToEnd: {
        p50Ms: path.p50Ms,
        p99Ms: path.p99Ms,
        topologyAvailability: topologyAvailability(components, graph.edges),
        errorRate,
        estimatedMonthlyCostUsd: monthlyCost(graph),
        staleReadWindowMs: staleReadWindowMs(graph),
      },
    },
    verdicts: [],
  }

  result.verdicts = runRules({
    graph,
    components,
    load,
    scenario,
    result,
    faults,
  })
  return result
}
