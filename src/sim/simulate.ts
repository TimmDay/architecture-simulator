import { CATALOGUE, HOURS_PER_MONTH } from "./catalogue"
import type {
  ArchitectureGraph,
  ComponentKind,
  ComponentSpec,
  VendorFamily,
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
  /**
   * Latency multiplier from a `latency-spike` fault -- a dependency that has
   * gone slow without going down. This is the quiet failure mode: nothing
   * errors, everything just takes longer.
   */
  latencyMultiplier: number
}

/** Apply one round of faults, producing the component set the round actually runs against. */
export function applyFaults(
  graph: ArchitectureGraph,
  faults: FaultEvent[],
): {
  components: EffectiveComponent[]
  partitionedEdgeIds: Set<string>
  flushedCacheIds: Set<string>
  trafficMultiplier: number
} {
  const partitionedEdgeIds = new Set<string>()
  const flushedCacheIds = new Set<string>()
  let trafficMultiplier = 1

  for (const f of faults) {
    if (f.kind === "traffic-spike") trafficMultiplier *= f.multiplier
    if (f.kind === "cache-flush") flushedCacheIds.add(f.componentId)
  }

  const components = graph.components.map((c): EffectiveComponent => {
    let alive = c.instances
    let latencyMultiplier = 1
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
        case "latency-spike":
          if (f.componentId === c.id) latencyMultiplier *= f.multiplier
          break
        default:
          break
      }
    }

    for (const f of faults) {
      if (f.kind === "network-partition") partitionedEdgeIds.add(f.edgeId)
    }

    alive = Math.max(0, alive)
    return {
      ...c,
      aliveInstances: alive,
      domains: Math.min(alive, zones),
      latencyMultiplier,
    }
  })

  return { components, partitionedEdgeIds, flushedCacheIds, trafficMultiplier }
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
  flushed = false,
): number {
  // A cold cache hits nothing. Every read falls through to the store behind it,
  // which is the stampede the store was being protected from.
  if (flushed) return 0
  const ttl = component.config.ttlSeconds ?? 60
  const ttlFactor = Math.min(1, ttl / 60)
  // No penalty for spiky or herd-shaped traffic. That was double-counting, and
  // backwards: a front-page event where a crowd reads the SAME page is the best
  // case for a cache, not the worst. How cacheable the workload is already
  // lives in `cacheableReadFraction`, which the scenario states precisely.
  // The stampede risk is a separate thing, and it is modelled as the
  // `cache-flush` fault rather than as a haircut on the steady-state hit rate.
  return load.cacheableReadFraction * ttlFactor
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
  flushedCacheIds: Set<string> = new Set(),
  trafficMultiplier = 1,
): { nodes: Map<string, Flow>; edges: Map<string, Flow> } {
  const byId = new Map(components.map((c) => [c.id, c]))
  const flows = new Map<string, Flow>()
  // Per-edge flow as well as per-node: egress is billed on what crosses a
  // particular link, not on what a component handled in total.
  const edgeFlows = new Map<string, Flow>()
  for (const c of components) flows.set(c.id, { reads: 0, writes: 0 })

  const offeredRps = load.peakRps * trafficMultiplier
  const totalReads =
    (offeredRps * load.readWriteRatio) / (load.readWriteRatio + 1)
  const totalWrites = offeredRps / (load.readWriteRatio + 1)

  const live = edges.filter(
    (e) =>
      !partitionedEdgeIds.has(e.id) &&
      e.kind !== "replication" &&
      e.kind !== "cdc",
  )

  /**
   * Split one component's outgoing flow across its edges.
   *
   * Routers divide; callers duplicate. Reads and writes are divided separately,
   * because an edge that only carries reads must not absorb a share of the
   * writes -- otherwise sending writes to the primary and reads to a replica
   * would silently lose half the write traffic.
   */
  function distribute(
    sourceId: string,
    flow: Flow,
  ): { id: string; flow: Flow }[] {
    const outgoing = live.filter((e) => e.from === sourceId)
    if (outgoing.length === 0) return []

    const source = byId.get(sourceId)
    const spec = source ? CATALOGUE[source.kind] : undefined
    // The implicit client node has no spec; it divides its users between
    // whatever entry points exist rather than cloning them.
    const routes = spec ? spec.routesTraffic : true

    const readEdges = outgoing.filter((e) => (e.carries ?? "all") !== "writes")
    const writeEdges = outgoing.filter((e) => (e.carries ?? "all") !== "reads")
    // For a router, `fanout` is a WEIGHT rather than a multiplier: an edge with
    // fanout 3 beside one with fanout 1 takes three quarters of the flow. Equal
    // weights give an even split, so the common case needs no thought, and
    // conservation holds whatever the weights are.
    const weight = (e: Edge) => e.fanout ?? 1
    const readWeight = readEdges.reduce((t, e) => t + weight(e), 0)
    const writeWeight = writeEdges.reduce((t, e) => t + weight(e), 0)

    const out: { id: string; flow: Flow }[] = []
    for (const e of outgoing) {
      const carries = e.carries ?? "all"
      let reads: number
      let writes: number
      if (routes) {
        reads =
          carries === "writes" || readWeight === 0
            ? 0
            : flow.reads * (weight(e) / readWeight)
        writes =
          carries === "reads" || writeWeight === 0
            ? 0
            : flow.writes * (weight(e) / writeWeight)
      } else {
        // A caller makes each of these calls per inbound request. Above 1 that
        // is an N+1; below 1 only a fraction of requests take the path.
        const f = weight(e)
        reads = carries === "writes" ? 0 : flow.reads * f
        writes = carries === "reads" ? 0 : flow.writes * f
      }
      if (reads > 0 || writes > 0) {
        const prev = edgeFlows.get(e.id) ?? { reads: 0, writes: 0 }
        edgeFlows.set(e.id, {
          reads: prev.reads + reads,
          writes: prev.writes + writes,
        })
        out.push({ id: e.to, flow: { reads, writes } })
      }
    }
    return out
  }

  const queue: { id: string; flow: Flow }[] = distribute(CLIENT_NODE_ID, {
    reads: totalReads,
    writes: totalWrites,
  })

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

    let outFlow = flow
    const spec = CATALOGUE[component.kind]
    if (spec?.caches) {
      // Sequential fallback: only misses continue downstream.
      outFlow = {
        reads:
          flow.reads *
          (1 - cacheHitRatio(component, load, flushedCacheIds.has(id))),
        writes: flow.writes,
      }
    }

    queue.push(...distribute(id, outFlow))
  }

  return { nodes: flows, edges: edgeFlows }
}

/**
 * Server rendering is work, and the work lands on the app tier.
 *
 * Rather than inflating the request COUNT -- which would break conservation and
 * conflate page views with API calls -- this derates how many requests each app
 * instance can serve. "SSR is why this tier needs twice the instances" then
 * shows up as utilization you can point at, rather than as an opaque
 * coefficient buried in the flow.
 */
export const SSR_CAPACITY_FACTOR = 0.5

export function renderingCapacityFactor(
  graph: ArchitectureGraph,
  kind: ComponentKind,
): number {
  if (kind !== "app-server") return 1
  const client = graph.components.find((c) => c.kind === "web-client")
  return client?.config.rendering === "ssr" ? SSR_CAPACITY_FACTOR : 1
}

function metricsFor(
  component: EffectiveComponent,
  flow: Flow,
  capacityFactor = 1,
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

  const readCap = spec.capacity.readRps * alive * capacityFactor
  const writeCap = spec.capacity.writeRps * alive * capacityFactor
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
    // A slow dependency multiplies service time; queueing inflation then
    // compounds on top of it, which is why a modest slowdown upstream can
    // produce a dramatic one downstream.
    p50Ms: spec.baseLatency.p50Ms * inflation * component.latencyMultiplier,
    p99Ms: spec.baseLatency.p99Ms * inflation * component.latencyMultiplier,
    droppedRps: utilization >= 1 ? Math.max(0, offered - capacity) : 0,
  }
}

/** Longest latency path from the client, which is what the user actually waits for. */
function criticalPath(
  components: EffectiveComponent[],
  edges: Edge[],
  perComponent: Record<string, ComponentMetrics>,
  partitionedEdgeIds: Set<string>,
  graph: ArchitectureGraph,
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
      if (!ids.has(e.to)) continue
      // Leaving one provider's network for another is a real hop over the
      // public internet, not a link inside a datacentre.
      const hop = crossesVendors(graph, e)
        ? {
            p50Ms: here.p50Ms + CROSS_VENDOR_LATENCY_MS.p50,
            p99Ms: here.p99Ms + CROSS_VENDOR_LATENCY_MS.p99,
          }
        : here
      walk(e.to, hop, depth + 1)
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

  // An empty or disconnected graph is not 100% available -- it serves nothing.
  // Without this the empty canvas reads as a perfect score.
  if (reachable.size === 0) return 0

  let availability = 1
  for (const c of components) {
    if (!reachable.has(c.id)) continue
    const spec = CATALOGUE[c.kind]
    if (!spec) continue
    // Not ours to keep up. Counting the user's browser in the serial product
    // would say that shipping a web app makes the system less reliable.
    if (spec.clientSide) continue
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
  const base = Math.max(1, spec.managed ? zones : Math.min(c.instances, zones))
  // A standby occupies a second failure domain without serving any traffic --
  // which is exactly the trade: availability, no capacity, double the bill.
  return c.config.standby ? Math.max(2, base) : base
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

/**
 * Which provider family a component is bought from, if one has been chosen.
 */
export function vendorFamily(c: PlacedComponent): VendorFamily | undefined {
  const spec = CATALOGUE[c.kind]
  if (!spec) return undefined
  return spec.vendors.find((v) => v.id === c.config.vendor)?.family
}

export function vendorLabel(c: PlacedComponent): string | undefined {
  const spec = CATALOGUE[c.kind]
  return spec?.vendors.find((v) => v.id === c.config.vendor)?.label
}

/** Does this link leave one provider's network and enter another's? */
export function crossesVendors(graph: ArchitectureGraph, edge: Edge): boolean {
  const from = graph.components.find((c) => c.id === edge.from)
  const to = graph.components.find((c) => c.id === edge.to)
  if (!from || !to) return false
  const a = vendorFamily(from)
  const b = vendorFamily(to)
  // Unspecified on either side means the question has not been answered yet;
  // guessing would invent a cost the player never chose.
  if (!a || !b) return false
  return a !== b
}

/**
 * Monthly egress for one request per second sustained across a provider
 * boundary.
 *
 * Assumes roughly a 3KB average payload at about $0.09/GB, which is the going
 * rate for leaving a major cloud. 100 rps crossing a boundary therefore costs
 * around $70/month -- enough to notice on a hot path, not enough to make every
 * cross-vendor design instantly absurd, which matches reality.
 */
export const EGRESS_USD_PER_RPS_MONTH = 0.7

/** Extra network latency for a hop that leaves one provider for another. */
export const CROSS_VENDOR_LATENCY_MS = { p50: 8, p99: 35 }

export function egressCost(
  graph: ArchitectureGraph,
  edgeFlows: Map<string, Flow>,
): number {
  let total = 0
  for (const e of graph.edges) {
    if (!crossesVendors(graph, e)) continue
    const f = edgeFlows.get(e.id)
    if (!f) continue
    total += (f.reads + f.writes) * EGRESS_USD_PER_RPS_MONTH
  }
  return total
}

export function monthlyCost(graph: ArchitectureGraph): number {
  return graph.components.reduce((sum, c) => {
    const spec = CATALOGUE[c.kind]
    if (!spec || spec.clientSide) return sum
    // A standby is a whole second machine you pay for and never serve from.
    const units = c.instances + (c.config.standby ? 1 : 0)
    return sum + spec.costPerInstanceHourUsd * HOURS_PER_MONTH * units
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
  const { components, partitionedEdgeIds, flushedCacheIds, trafficMultiplier } =
    applyFaults(graph, faults)
  const { nodes: flows, edges: edgeFlows } = propagate(
    components,
    graph.edges,
    load,
    partitionedEdgeIds,
    flushedCacheIds,
    trafficMultiplier,
  )

  const perComponent: Record<string, ComponentMetrics> = {}
  for (const c of components) {
    perComponent[c.id] = metricsFor(
      c,
      flows.get(c.id) ?? { reads: 0, writes: 0 },
      renderingCapacityFactor(graph, c.kind),
    )
  }

  const path = criticalPath(
    components,
    graph.edges,
    perComponent,
    partitionedEdgeIds,
    graph,
  )

  const offered = load.peakRps * trafficMultiplier
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
        estimatedMonthlyCostUsd:
          monthlyCost(graph) + egressCost(graph, edgeFlows),
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
