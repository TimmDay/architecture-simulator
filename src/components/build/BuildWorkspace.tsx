"use client"

import { useCallback, useMemo, useRef, useState } from "react"
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
import { Activity, Play, RotateCcw, ShieldAlert } from "lucide-react"
import { CATALOGUE } from "~/sim/catalogue"
import { gradeAttempt, type AttemptResult } from "~/sim/grade"
import { simulate } from "~/sim/simulate"
import { applyFaults } from "~/sim/simulate"
import type {
  ArchitectureGraph,
  ComponentKind,
  Edge as SimEdge,
  PlacedComponent,
  Scenario,
} from "~/sim/types"
import { CLIENT_NODE_ID } from "~/sim/types"
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
  const [enqueued, setEnqueued] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

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
          kind: "sync-request",
          carries: cfg.carries ?? "all",
          fanout: cfg.fanout ?? 1,
          timeoutMs: 2000,
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
        if (cfg.carries && cfg.carries !== "all") bits.push(cfg.carries)
        if ((cfg.fanout ?? 1) > 1) bits.push(`×${cfg.fanout}`)
        return {
          ...e,
          label: bits.join(" "),
          labelStyle: { fill: "#8a94a8", fontSize: 10 },
          labelBgStyle: { fill: "#131822" },
          selected: e.id === selectedEdgeId,
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
              carries: kind ? defaultCarries(kind) : "all",
              fanout: 1,
            } satisfies EdgeConfig,
          },
          eds,
        ),
      )
    },
    [setEdges, nodes],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData(
        "application/architecture-kind",
      ) as ComponentKind
      const spec = CATALOGUE[kind]
      if (!spec) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
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
      setSelectedId(id)
    },
    [screenToFlowPosition, setNodes],
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
  }, [setNodes, setEdges, scenario])

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

  const selected = nodes.find((n) => n.id === selectedId)
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)
  const labelOf = (id: string) =>
    id === CLIENT_NODE_ID
      ? "Users"
      : ((nodes.find((n) => n.id === id) as ComponentNodeType | undefined)?.data
          .component.label ?? id)
  const e2e = live.metrics.endToEnd

  return (
    <div className="flex h-[calc(100vh-49px)]">
      {/* Left: brief + palette */}
      {/* Scrolls internally so the reset button can stay pinned to the base
          rather than hiding below a long brief and a long palette. */}
      <aside className="border-line bg-panel/40 flex w-80 shrink-0 flex-col border-r">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-fog">{k}</dt>
                  <dd className="text-chalk">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-5">
            <Palette kinds={scenario.availableKinds} />
          </div>
        </div>

        <div className="border-line bg-panel/60 shrink-0 border-t p-3">
          <button
            onClick={resetBoard}
            className="border-line text-fog hover:text-chalk hover:border-fog/50 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] transition-colors"
          >
            <RotateCcw size={12} /> Reset scenario
          </button>
        </div>
      </aside>

      {/* Centre: canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Wraps rather than overflowing: three probe buttons plus the metrics
            do not fit beside the slider once both rails are open. */}
        <div className="border-line bg-panel/40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
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
              label="cost"
              value={`$${Math.round(e2e.estimatedMonthlyCostUsd)}`}
              bad={
                e2e.estimatedMonthlyCostUsd >
                scenario.requirements.monthlyBudgetUsd
              }
            />
          </div>

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

        <div ref={wrapper} className="min-h-0 flex-1">
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
            onNodeClick={(_, n) => {
              setSelectedId(n.id)
              setSelectedEdgeId(null)
            }}
            onEdgeClick={(_, e) => {
              setSelectedEdgeId(e.id)
              setSelectedId(null)
            }}
            onPaneClick={() => {
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

      {/* Right: config + results */}
      <aside className="border-line bg-panel/40 w-80 shrink-0 overflow-y-auto border-l p-4">
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
              carries:
                (selectedEdge.data?.carries as EdgeConfig["carries"]) ?? "all",
              fanout: (selectedEdge.data?.fanout as number) ?? 1,
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
