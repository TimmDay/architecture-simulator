"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge as FlowEdge,
} from "@xyflow/react"
import Link from "next/link"
import {
  Activity,
  ChevronLeft,
  Lightbulb,
  MousePointerClick,
  PanelLeftOpen,
  PanelRightOpen,
  Play,
  RotateCcw,
  ShieldAlert,
  Undo2,
} from "lucide-react"
import { CATALOGUE } from "~/sim/catalogue"
import { gradeAttempt, type AttemptResult } from "~/sim/grade"
import { simulate } from "~/sim/simulate"
import { layoutGraph } from "~/sim/layout"
import { applyFaults } from "~/sim/simulate"
import type {
  ArchitectureGraph,
  ComponentKind,
  Edge as SimEdge,
  PlacedComponent,
  Scenario,
} from "~/sim/types"
import { CLIENT_NODE_ID, FEATURE_LABELS } from "~/sim/types"
import { ALL_CARDS } from "~/drill/cards"
import { enqueueFromVerdict, newCardState } from "~/drill/sm2"
import { getProgressStore } from "~/storage"
import { ComponentNode, type ComponentNodeType } from "./ComponentNode"
import { ClientNode, type ClientNodeType } from "./ClientNode"
import { Palette } from "./Palette"
import { ConfigPanel } from "./ConfigPanel"
import { ResultsPanel } from "./ResultsPanel"
import { EdgePanel, type EdgeConfig } from "./EdgePanel"

const nodeTypes = { component: ComponentNode, client: ClientNode }

let seq = 0
const nextId = (kind: string) => `${kind}-${++seq}`

/** Default edge semantics by target kind, so the common case needs no fiddling. */
function defaultCarries(
  targetKind: ComponentKind | "client",
): EdgeConfig["carries"] {
  if (
    targetKind === "sql-replica" ||
    targetKind === "cdn" ||
    targetKind === "cache"
  )
    return "reads"
  return "all"
}

function Workspace({ scenario }: { scenario: Scenario }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<
    ComponentNodeType | ClientNodeType
  >([
    {
      id: CLIENT_NODE_ID,
      type: "client",
      position: { x: 20, y: 150 },
      data: { rps: scenario.loadProfiles[0]?.peakRps ?? 0 },
      deletable: false,
    } as ClientNodeType,
  ])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [profileIndex, setProfileIndex] = useState(0)
  const [result, setResult] = useState<AttemptResult | null>(null)
  /**
   * Your own design, stashed while the reference is on screen.
   *
   * Showing a solution must not destroy the attempt that earned the right to
   * see it -- comparing the two is the entire value, and losing your work to a
   * misplaced tap would make the button something to be afraid of.
   */
  /**
   * The right rail starts closed so the canvas gets the width. A full system is
   * seven or eight columns across and the guide is read once.
   *
   * It opens itself the moment there is something to say -- a selected
   * component, a selected connection, a graded result -- because a panel that
   * stays shut while you click a box would make selection look broken.
   */
  const [railOpen, setRailOpen] = useState(false)
  /**
   * Which panel a phone is looking at.
   *
   * Three columns at 390px gave the canvas 38px. They become tabs instead --
   * the brief, the board and the results are read one at a time on a phone
   * anyway, and the canvas gets the whole screen when it is the one in view.
   */
  const [tab, setTab] = useState<"brief" | "canvas" | "panel">("canvas")
  const [stashed, setStashed] = useState<{
    nodes: (ComponentNodeType | ClientNodeType)[]
    edges: FlowEdge[]
  } | null>(null)
  const [enqueued, setEnqueued] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const load = scenario.loadProfiles[profileIndex] ?? scenario.loadProfiles[0]!

  /** The canvas is the source of truth; this projects it into the engine's shape. */
  const graph: ArchitectureGraph = useMemo(
    () => ({
      components: nodes
        .filter((n): n is ComponentNodeType => n.type === "component")
        .map((n) => n.data.component),
      edges: edges.map((e): SimEdge => {
        const cfg = (e.data ?? {}) as Partial<EdgeConfig>
        return {
          id: e.id,
          from: e.source,
          to: e.target,
          kind: cfg.kind ?? "sync-request",
          carries: cfg.carries ?? "all",
          fanout: cfg.fanout ?? 1,
          timeoutMs: cfg.timeoutMs ?? 2000,
          circuitBreaker: cfg.circuitBreaker ?? false,
          retries: 2,
          jitter: true,
        }
      }),
    }),
    [nodes, edges],
  )

  // Live metrics under the current slider position, with no faults. This is what
  // makes the slider feel like an instrument rather than a form field.
  const live = useMemo(
    () => simulate({ graph, load, faults: [], scenario }),
    [graph, load, scenario],
  )

  /**
   * Cost is graded at peak, so it is shown at peak. Egress scales with traffic,
   * which means the figure now moves with the slider -- and a budget readout
   * that disagrees with the budget you are marked against is worse than one
   * that does not move at all.
   */
  const peakCost = useMemo(() => {
    const peak = scenario.loadProfiles[scenario.loadProfiles.length - 1]
    if (!peak) return live.metrics.endToEnd.estimatedMonthlyCostUsd
    return simulate({ graph, load: peak, faults: [], scenario }).metrics
      .endToEnd.estimatedMonthlyCostUsd
  }, [graph, scenario, live])

  const deadIds = useMemo(() => {
    if (!result) return new Set<string>()
    const failing = result.rounds.find((r) => !r.survived)
    if (!failing) return new Set<string>()
    const round = scenario.faultScript[result.rounds.indexOf(failing)] ?? []
    const { components } = applyFaults(graph, round)
    return new Set(
      components.filter((c) => c.aliveInstances === 0).map((c) => c.id),
    )
  }, [result, graph, scenario])

  // Push live metrics back onto the nodes so each box shows its own utilization.
  const decoratedNodes = useMemo(
    (): (ComponentNodeType | ClientNodeType)[] =>
      nodes.map((n) =>
        n.type === "component"
          ? ({
              ...n,
              data: {
                ...n.data,
                metrics: live.metrics.perComponent[n.id],
                dead: deadIds.has(n.id),
              },
            } satisfies ComponentNodeType)
          : ({ ...n, data: { rps: load.peakRps } } satisfies ClientNodeType),
      ),
    [nodes, live, deadIds, load],
  )

  /** Label edges that do something non-obvious, so the picture is self-explaining. */
  const decoratedEdges = useMemo(
    () =>
      edges.map((e) => {
        const cfg = (e.data ?? {}) as Partial<EdgeConfig>
        const bits: string[] = []
        if (cfg.kind === "async-publish") bits.push("async")
        if (cfg.carries && cfg.carries !== "all") bits.push(cfg.carries)
        if ((cfg.fanout ?? 1) !== 1) bits.push(`×${cfg.fanout}`)
        if (cfg.circuitBreaker) bits.push("CB")
        return {
          ...e,
          label: bits.join(" "),
          labelStyle: { fill: "#8a94a8", fontSize: 10 },
          labelBgStyle: { fill: "#131822" },
          selected: e.id === selectedEdgeId,
          // Asynchronous links are drawn dashed and still, because they are not
          // on anybody's clock -- the picture should say so.
          animated: cfg.kind !== "async-publish",
          style:
            cfg.kind === "async-publish"
              ? { strokeDasharray: "2 4", stroke: "#6ea8fe" }
              : undefined,
        }
      }),
    [edges, selectedEdgeId],
  )

  const updateEdge = useCallback(
    (id: string, next: EdgeConfig) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, data: next } : e)),
      )
    },
    [setEdges],
  )

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id))
      setSelectedEdgeId(null)
    },
    [setEdges],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      const target = nodes.find((n) => n.id === c.target)
      const kind =
        target?.type === "component" ? target.data.component.kind : undefined
      setEdges((eds) =>
        addEdge(
          {
            ...c,
            animated: true,
            // Defaulted from what it points at -- a replica or cache takes reads
            // -- but always overridable, because a mistake you cannot express is
            // one the engine can never teach you about.
            data: {
              kind: "sync-request",
              carries: kind ? defaultCarries(kind) : "all",
              fanout: 1,
              circuitBreaker: false,
              timeoutMs: 2000,
            } satisfies EdgeConfig,
          },
          eds,
        ),
      )
    },
    [setEdges, nodes],
  )

  /**
   * Put a component on the canvas at a screen point.
   *
   * Shared by dragging and tapping. HTML5 drag-and-drop never fires on a touch
   * device -- `touchstart` arrives, `dragstart` does not -- so on a phone the
   * palette was decorative and nothing could be placed at all. Arming a
   * component with one tap and dropping it with a second is the same gesture
   * without the parts that need a mouse.
   */
  const placeComponent = useCallback(
    (kind: ComponentKind, screenX: number, screenY: number) => {
      const spec = CATALOGUE[kind]
      if (!spec) return
      const position = screenToFlowPosition({ x: screenX, y: screenY })
      const id = nextId(kind)
      const component: PlacedComponent = {
        id,
        kind,
        label: spec.label,
        instances: 1,
        region: "eu-west-1",
        config: {
          // A managed service is multi-AZ as bought -- defaulting it to a single
          // zone would flag every cloud load balancer as a single point of
          // failure, which is wrong and trains the wrong instinct.
          availabilityZones: spec.managed ? 2 : 1,
          // Default to the first option rather than "not decided". Almost every
          // team really does start on one provider, so the default build is
          // single-vendor and the concentration conversation arrives on its own
          // once the system is big enough for it to matter.
          vendor: spec.vendors[0]?.id,
          ...(kind === "app-server"
            ? { sessionStore: "in-memory" as const }
            : {}),
          ...(kind === "cache" ? { ttlSeconds: 60 } : {}),
        },
      }
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "component",
          position,
          data: { component },
        } as ComponentNodeType,
      ])
      justPlaced.current = true
      setSelectedId(id)
    },
    [screenToFlowPosition, setNodes],
  )

  const [armedKind, setArmedKind] = useState<ComponentKind | null>(null)
  /**
   * Set while the selection came from placing rather than from tapping an
   * existing component. Placing selects the new node so its config is ready,
   * but on a phone that must not switch tabs: you would be thrown off the
   * board the instant you put something on it.
   */
  const justPlaced = useRef(false)

  useEffect(() => {
    if (!armedKind) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmedKind(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [armedKind])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData(
        "application/architecture-kind",
      ) as ComponentKind
      placeComponent(kind, event.clientX, event.clientY)
    },
    [placeComponent],
  )

  const updateComponent = useCallback(
    (next: PlacedComponent) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.type === "component" && n.id === next.id
            ? ({
                ...n,
                data: { ...n.data, component: next },
              } satisfies ComponentNodeType)
            : n,
        ),
      )
    },
    [setNodes],
  )

  const deleteComponent = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
      setSelectedId(null)
    },
    [setNodes, setEdges],
  )

  /** Clear the board back to an empty scenario: just the traffic source. */
  const resetBoard = useCallback(() => {
    setNodes([
      {
        id: CLIENT_NODE_ID,
        type: "client",
        position: { x: 20, y: 150 },
        data: { rps: scenario.loadProfiles[0]?.peakRps ?? 0 },
        deletable: false,
      } satisfies ClientNodeType,
    ])
    setEdges([])
    setSelectedId(null)
    setSelectedEdgeId(null)
    setResult(null)
    setEnqueued(false)
    setProfileIndex(0)
    setStashed(null)
  }, [setNodes, setEdges, scenario])

  /** Load the scenario's worked solution onto the canvas, laid out. */
  const showSolution = useCallback(() => {
    if (!stashed) setStashed({ nodes, edges })
    const positions = layoutGraph(scenario.reference)
    setNodes([
      {
        id: CLIENT_NODE_ID,
        type: "client",
        position: positions[CLIENT_NODE_ID] ?? { x: 20, y: 150 },
        data: { rps: scenario.loadProfiles[0]?.peakRps ?? 0 },
        deletable: false,
      } satisfies ClientNodeType,
      ...scenario.reference.components.map(
        (component) =>
          ({
            id: component.id,
            type: "component",
            position: positions[component.id] ?? { x: 0, y: 0 },
            data: { component },
          }) satisfies ComponentNodeType,
      ),
    ])
    setEdges(
      scenario.reference.edges
        // Replication and CDC are modelled but not drawn as request arrows;
        // showing them as ordinary edges would misrepresent the request path.
        .filter((e) => e.kind === "sync-request" || e.kind === "async-publish")
        .map((e) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          animated: e.kind === "sync-request",
          data: {
            kind: e.kind === "async-publish" ? "async-publish" : "sync-request",
            carries: e.carries ?? "all",
            fanout: e.fanout ?? 1,
            circuitBreaker: e.circuitBreaker ?? false,
            timeoutMs: e.timeoutMs ?? 2000,
          } satisfies EdgeConfig,
        })),
    )
    setSelectedId(null)
    setSelectedEdgeId(null)
    setResult(null)
    // fitView only runs on mount, so replacing the whole board leaves the
    // viewport wherever it was -- usually zoomed into two of ten nodes. The
    // frame's delay lets React Flow measure the new nodes before it fits them.
    requestAnimationFrame(() =>
      fitView({ padding: 0.2, maxZoom: 1, duration: 300 }),
    )
  }, [scenario, nodes, edges, stashed, setNodes, setEdges, fitView])

  /** Put your own design back exactly as it was. */
  const restoreMyDesign = useCallback(() => {
    if (!stashed) return
    setNodes(stashed.nodes)
    setEdges(stashed.edges)
    setStashed(null)
    setSelectedId(null)
    setSelectedEdgeId(null)
    setResult(null)
    requestAnimationFrame(() =>
      fitView({ padding: 0.2, maxZoom: 1, duration: 300 }),
    )
  }, [stashed, setNodes, setEdges, fitView])

  const run = useCallback(
    (probe: "pressure" | "security" | "observability" = "pressure") => {
      // Each probe is the same engine with extra rounds, and for observability
      // an extra pass of derived findings. There is no second simulator.
      let probed: Scenario = scenario
      if (probe === "security") {
        probed = {
          ...scenario,
          faultScript: [
            ...scenario.faultScript,
            [
              { kind: "unauthenticated-probe" },
              { kind: "credential-stuffing", rps: 500 },
            ],
          ],
        }
      } else if (probe === "observability") {
        // Deliberately QUIET faults. A dependency that goes slow rather than
        // down, and a cache that empties, are the failures that keep every
        // dashboard green -- which is the whole point of this probe.
        const slowTarget =
          graph.components.find((c) => c.kind === "sql-primary") ??
          graph.components.find((c) => c.kind === "app-server")
        const cache = graph.components.find((c) => c.kind === "cache")
        probed = {
          ...scenario,
          faultScript: [
            ...scenario.faultScript,
            ...(slowTarget
              ? [
                  [
                    {
                      kind: "latency-spike" as const,
                      componentId: slowTarget.id,
                      multiplier: 6,
                    },
                  ],
                ]
              : []),
            ...(cache
              ? [[{ kind: "cache-flush" as const, componentId: cache.id }]]
              : []),
          ],
        }
      }
      const graded = gradeAttempt(graph, probed, {
        observability: probe === "observability",
      })
      setResult(graded)
      setEnqueued(false)
      // Both panels share the right rail, and the config panel wins while
      // something is selected -- so running the test with a component still
      // selected would hide the very results you asked for.
      setSelectedId(null)
      void getProgressStore().saveAttempt({
        id: `${Date.now()}`,
        scenarioId: scenario.id,
        at: new Date().toISOString(),
        passed: graded.passed,
        grade: graded.grade,
        requirementResults: graded.requirements,
        failedRuleIds: graded.verdicts
          .filter((v) => v.severity === "fail")
          .map((v) => v.ruleId),
      })
    },
    [graph, scenario],
  )

  /**
   * The loop that makes this one app rather than two.
   *
   * Every failed verdict's topics resolve to cards, and those cards are pulled
   * to the front of the drill deck -- tagged with the rule that earned them, so
   * tomorrow's review says why you are seeing it.
   */
  const enqueueTopics = useCallback(async () => {
    if (!result) return
    const store = getProgressStore()
    const existing = new Map(
      (await store.getCardStates()).map((s) => [s.cardId, s]),
    )
    const updates = new Map<string, ReturnType<typeof enqueueFromVerdict>>()

    for (const verdict of result.verdicts.filter(
      (v) => v.severity === "fail",
    )) {
      for (const card of ALL_CARDS) {
        if (!card.topicIds.some((t) => verdict.topicIds.includes(t))) continue
        const base = existing.get(card.id) ?? newCardState(card.id)
        updates.set(
          card.id,
          enqueueFromVerdict(base, {
            scenarioId: result.baseline ? scenario.id : scenario.id,
            ruleId: verdict.ruleId,
          }),
        )
      }
    }
    await store.saveCardStates([...updates.values()])
    setEnqueued(true)
  }, [result, scenario])

  useEffect(() => {
    if (selectedId || selectedEdgeId || result) {
      setRailOpen(true)
      // On a phone the panel is a tab, not a column: opening it off-screen
      // would make running a pressure test look like it did nothing.
      if (justPlaced.current) justPlaced.current = false
      else setTab("panel")
    }
  }, [selectedId, selectedEdgeId, result])

  const selected = nodes.find((n) => n.id === selectedId)
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)
  const labelOf = (id: string) =>
    id === CLIENT_NODE_ID
      ? "Users"
      : ((nodes.find((n) => n.id === id) as ComponentNodeType | undefined)?.data
          .component.label ?? id)
  const e2e = live.metrics.endToEnd

  return (
    <div className="flex h-[calc(100vh-var(--nav-h))] flex-col sm:flex-row">
      <div className="border-line bg-panel/40 flex shrink-0 border-b sm:hidden">
        {(
          [
            ["brief", "Brief"],
            ["canvas", "Board"],
            ["panel", "Results"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`flex-1 py-2.5 text-[12px] font-medium transition-colors ${
              tab === value
                ? "text-chalk border-accent border-b-2"
                : "text-fog border-b-2 border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Left: brief + palette */}
      {/* Scrolls internally so the reset button can stay pinned to the base
          rather than hiding below a long brief and a long palette. */}
      <aside
        className={`border-line bg-panel/40 flex flex-col border-r max-sm:min-h-0 max-sm:w-full max-sm:flex-1 max-sm:border-r-0 sm:w-80 sm:shrink-0 ${
          tab === "brief" ? "" : "max-sm:hidden"
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Link
            href="/build"
            className="text-fog hover:text-chalk mb-2 flex items-center gap-1 text-[11px]"
          >
            <ChevronLeft size={12} /> All scenarios
          </Link>
          <h2 className="text-chalk text-base font-semibold">
            {scenario.title}
          </h2>
          <p className="text-chalk/80 mt-2.5 text-[13px] leading-relaxed whitespace-pre-line">
            {scenario.brief}
          </p>

          <div className="border-line bg-panel mt-4 rounded-lg border p-3">
            <h3 className="text-fog mb-2 text-[11px] font-medium tracking-wide uppercase">
              Must meet
            </h3>
            <dl className="space-y-1.5 text-[12px]">
              {[
                ["p99 latency", `≤ ${scenario.requirements.p99Ms}ms`],
                [
                  "Availability",
                  `≥ ${(scenario.requirements.availability * 100).toFixed(2)}%`,
                ],
                ["Budget", `≤ $${scenario.requirements.monthlyBudgetUsd}/mo`],
                ["Durability", scenario.requirements.durability],
                ["Consistency", scenario.requirements.consistency],
                ...(scenario.requirements.compliance
                  ? [
                      [
                        "Compliance",
                        scenario.requirements.compliance
                          .join(", ")
                          .toUpperCase(),
                      ] as [string, string],
                    ]
                  : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-fog">{k}</dt>
                  <dd className="text-chalk">{v}</dd>
                </div>
              ))}
            </dl>

            <h3 className="text-fog mt-3 mb-1.5 text-[11px] font-medium tracking-wide uppercase">
              The system does
            </h3>
            <ul className="space-y-1">
              {scenario.features.map((f) => (
                <li key={f} className="text-chalk/80 flex gap-1.5 text-[12px]">
                  <span className="text-accent">·</span>
                  {FEATURE_LABELS[f]}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <Palette
              kinds={scenario.availableKinds}
              armed={armedKind}
              onArm={setArmedKind}
            />
          </div>
        </div>

        <div className="border-line bg-panel/60 shrink-0 space-y-2 border-t p-3">
          {stashed ? (
            <button
              onClick={restoreMyDesign}
              className="border-accent/40 bg-accent/15 text-accent hover:bg-accent/25 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] font-medium transition-colors"
            >
              <Undo2 size={12} /> Back to my design
            </button>
          ) : (
            <button
              onClick={showSolution}
              title="Loads a build that passes. Your own design is kept."
              className="border-line text-fog hover:text-chalk hover:border-fog/50 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] transition-colors"
            >
              <Lightbulb size={12} /> See a solution
            </button>
          )}
          <button
            onClick={resetBoard}
            className="border-line text-fog hover:text-chalk hover:border-fog/50 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] transition-colors"
          >
            <RotateCcw size={12} /> Reset scenario
          </button>
        </div>
      </aside>

      {/* Centre: canvas */}
      <div
        className={`flex min-w-0 flex-1 flex-col ${
          tab === "canvas" ? "" : "max-sm:hidden"
        }`}
      >
        {/* Two explicit rows rather than one wrapping one. Wrapping broke
            wherever it happened to fit, so Pressure would sit up beside the
            metrics while Security and Observability dropped below it -- three
            buttons that do the same kind of thing, split across two lines. */}
        <div className="border-line bg-panel/40 space-y-2 border-b px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-fog text-[11px]">Traffic</span>
              <input
                type="range"
                min={0}
                max={scenario.loadProfiles.length - 1}
                value={profileIndex}
                onChange={(e) => setProfileIndex(+e.target.value)}
                className="accent-accent w-40"
              />
              <span className="text-chalk min-w-0 truncate text-[11px]">
                {load.label}{" "}
                <span className="text-fog">· {load.peakRps} rps peak</span>
              </span>
            </div>

            <div className="text-fog ml-auto flex items-center gap-4 text-[11px]">
              <Metric
                label="p99"
                value={`${Math.round(e2e.p99Ms)}ms`}
                bad={e2e.p99Ms > scenario.requirements.p99Ms}
              />
              <Metric
                label="avail"
                value={`${(e2e.topologyAvailability * 100).toFixed(2)}%`}
                bad={
                  e2e.topologyAvailability < scenario.requirements.availability
                }
              />
              <Metric
                label="cost/mo at peak"
                value={`$${Math.round(peakCost)}`}
                bad={peakCost > scenario.requirements.monthlyBudgetUsd}
              />
            </div>
          </div>

          {/* Row two: the probes, always together. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => run("pressure")}
              title="Turn the traffic up and run the fault script"
              className="bg-accent/15 text-accent hover:bg-accent/25 flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-colors"
            >
              <Play size={12} /> Pressure
            </button>
            <button
              onClick={() => run("security")}
              title="Probe the design for vulnerabilities"
              className="bg-fail/15 text-fail hover:bg-fail/25 flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-colors"
            >
              <ShieldAlert size={12} /> Security
            </button>
            <button
              onClick={() => run("observability")}
              title="Would you know this broke, and would you know where?"
              className="bg-warn/15 text-warn hover:bg-warn/25 flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-colors"
            >
              <Activity size={12} /> Observability
            </button>
          </div>
        </div>

        {stashed && (
          <div className="border-accent/30 bg-accent/10 flex items-center gap-2 border-b px-4 py-2 text-[12px]">
            <Lightbulb size={13} className="text-accent shrink-0" />
            <span className="text-chalk">
              This is <strong>a</strong> solution, not <strong>the</strong>{" "}
              solution — most of these have several. Poke at it: change instance
              counts, pull a component out, run the pressure test and see what
              it was buying.
            </span>
            <button
              onClick={restoreMyDesign}
              className="text-accent hover:text-chalk ml-auto shrink-0 underline underline-offset-2"
            >
              Back to my design
            </button>
          </div>
        )}

        {armedKind && (
          <div className="border-accent/30 bg-accent/10 flex items-center gap-2 border-b px-4 py-2 text-[12px]">
            <MousePointerClick size={13} className="text-accent shrink-0" />
            <span className="text-chalk">
              Tap the canvas to place{" "}
              <strong>{CATALOGUE[armedKind]?.label}</strong>.
            </span>
            <button
              onClick={() => setArmedKind(null)}
              className="text-fog hover:text-chalk ml-auto shrink-0 underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        )}

        <div
          ref={wrapper}
          className={`min-h-0 flex-1 ${armedKind ? "cursor-crosshair" : ""}`}
        >
          <ReactFlow
            nodes={decoratedNodes}
            edges={decoratedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
            }}
            onNodeClick={(event, n) => {
              if (armedKind) {
                placeComponent(armedKind, event.clientX, event.clientY)
                setArmedKind(null)
                return
              }
              setSelectedId(n.id)
              setSelectedEdgeId(null)
            }}
            onEdgeClick={(_, e) => {
              setSelectedEdgeId(e.id)
              setSelectedId(null)
            }}
            onPaneClick={(event) => {
              if (armedKind) {
                placeComponent(armedKind, event.clientX, event.clientY)
                setArmedKind(null)
                return
              }
              setSelectedId(null)
              setSelectedEdgeId(null)
            }}
            nodeTypes={nodeTypes}
            fitView
            // Without a cap, fitView on a near-empty canvas zooms the single
            // client node until it fills the screen.
            fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
            minZoom={0.3}
            maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#273040" gap={18} size={1} />
            <Controls className="!bg-panel !border-line [&_button]:!bg-panel [&_button]:!border-line [&_button]:!fill-chalk" />
          </ReactFlow>
        </div>
      </div>

      {/* Right: config + results. Collapses to a spine so the canvas can have
          the width back; reopens itself whenever it has something to show. */}
      {!railOpen && (
        <button
          onClick={() => setRailOpen(true)}
          title="Show panel"
          aria-label="Show panel"
          className="border-line bg-panel/40 text-fog hover:text-chalk hidden w-8 shrink-0 flex-col items-center gap-2 border-l pt-4 transition-colors sm:flex"
        >
          <PanelLeftOpen size={14} />
          <span
            className="text-[10px] tracking-wide uppercase"
            style={{ writingMode: "vertical-rl" }}
          >
            Panel
          </span>
        </button>
      )}

      <aside
        className={`border-line bg-panel/40 overflow-y-auto border-l p-4 max-sm:w-full max-sm:flex-1 max-sm:border-l-0 sm:shrink-0 ${
          tab === "panel" ? "max-sm:block" : "max-sm:hidden"
        } ${railOpen ? "sm:block sm:w-80" : "sm:hidden"}`}
      >
        <button
          onClick={() => setRailOpen(false)}
          className="text-fog hover:text-chalk mb-3 ml-auto hidden items-center gap-1 text-[11px] sm:flex"
        >
          Hide <PanelRightOpen size={12} />
        </button>

        {selected?.type === "component" ? (
          <ConfigPanel
            component={selected.data.component}
            onChange={updateComponent}
            onDelete={() => deleteComponent(selected.id)}
          />
        ) : selectedEdge ? (
          <EdgePanel
            from={labelOf(selectedEdge.source)}
            to={labelOf(selectedEdge.target)}
            config={{
              kind:
                (selectedEdge.data?.kind as EdgeConfig["kind"]) ??
                "sync-request",
              carries:
                (selectedEdge.data?.carries as EdgeConfig["carries"]) ?? "all",
              fanout: (selectedEdge.data?.fanout as number) ?? 1,
              circuitBreaker:
                (selectedEdge.data?.circuitBreaker as boolean) ?? false,
              timeoutMs: (selectedEdge.data?.timeoutMs as number) ?? 2000,
            }}
            onChange={(next) => updateEdge(selectedEdge.id, next)}
            onDelete={() => deleteEdge(selectedEdge.id)}
          />
        ) : result ? (
          <>
            <button
              onClick={() => setResult(null)}
              className="text-fog hover:text-chalk mb-3 flex items-center gap-1.5 text-[11px]"
            >
              <RotateCcw size={11} /> Clear result
            </button>
            <ResultsPanel
              result={result}
              onEnqueueTopics={() => void enqueueTopics()}
              enqueued={enqueued}
            />
          </>
        ) : (
          <div className="text-fog/70 text-[12px] leading-relaxed">
            <p className="text-chalk mb-2 text-[13px] font-medium">
              How this works
            </p>
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>Drag components from the left onto the canvas.</li>
              <li>
                Drag from the dot on one box&apos;s right edge to the dot on
                another&apos;s left to connect them. One box can feed several —
                a load balancer across three app servers splits the traffic
                between them.
              </li>
              <li>
                Click a <strong className="text-chalk">box</strong> to set
                instances and zones, or a{" "}
                <strong className="text-chalk">line</strong> to set what it
                carries.
              </li>
              <li>
                Delete anything by selecting it and pressing{" "}
                <kbd className="border-line bg-panel-2 rounded border px-1">
                  Backspace
                </kbd>
                .
              </li>
              <li>
                Move the traffic slider and watch utilization change live.
              </li>
              <li>Run the pressure test when you think it will hold.</li>
            </ol>
            <p className="mt-3">
              Start from the Users node — traffic enters there.
            </p>
            <p className="text-fog/60 mt-2 text-[11px] leading-relaxed">
              Lines are <em>request</em> arrows and the response comes back
              along them, so you never draw one back the other way. For a
              database taking reads and writes from one server, a single line
              carrying both is right.
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}

function Metric({
  label,
  value,
  bad,
}: {
  label: string
  value: string
  bad: boolean
}) {
  return (
    <span>
      <span className="text-fog/60">{label} </span>
      <span className={bad ? "text-fail font-medium" : "text-chalk"}>
        {value}
      </span>
    </span>
  )
}

export function BuildWorkspace({ scenario }: { scenario: Scenario }) {
  return (
    <ReactFlowProvider>
      <Workspace scenario={scenario} />
    </ReactFlowProvider>
  )
}
