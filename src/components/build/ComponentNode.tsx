"use client"

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import {
  Boxes,
  Cloud,
  Database,
  Gauge,
  HardDrive,
  Network,
  Server,
  Zap,
} from "lucide-react"
import type {
  ComponentKind,
  ComponentMetrics,
  PlacedComponent,
} from "~/sim/types"

const ICONS: Partial<Record<ComponentKind, typeof Server>> = {
  "load-balancer": Network,
  "app-server": Server,
  "sql-primary": Database,
  "sql-replica": HardDrive,
  cache: Zap,
  cdn: Cloud,
  "api-gateway": Gauge,
}

export type ComponentNodeData = {
  component: PlacedComponent
  metrics?: ComponentMetrics
  dead?: boolean
}

export type ComponentNodeType = Node<ComponentNodeData, "component">

/** How far each stacked instance card is offset from the one below it. */
const STACK_OFFSET_PX = 5
/** Beyond this the pile stops reading as a count and starts hitting neighbours. */
const MAX_STACK = 4

/**
 * How many cards to draw BEHIND the front one.
 *
 * A single instance draws no pile at all -- the flat card has to stay visually
 * distinct, because "is this tier redundant?" is the question the stack exists
 * to answer at a glance.
 */
export function stackLayers(instances: number): number {
  return Math.max(0, Math.min(instances - 1, MAX_STACK))
}

export function ComponentNode({
  data,
  selected,
}: NodeProps<ComponentNodeType>) {
  const { component, metrics, dead } = data
  const Icon = ICONS[component.kind] ?? Boxes
  const util = metrics?.utilization ?? 0
  const hot = Number.isFinite(util) && util >= 0.8
  const over = !Number.isFinite(util) || util >= 1

  const border = dead
    ? "border-fail"
    : over
      ? "border-fail"
      : hot
        ? "border-warn"
        : selected
          ? "border-accent"
          : "border-line"

  // One card per instance, offset up and to the right, so a tier's redundancy is
  // legible without reading the count. Capped: past a handful the pile stops
  // meaning anything and starts colliding with neighbouring nodes, so the
  // multiplier carries it from there.
  const ghosts = stackLayers(component.instances)

  return (
    <div className="relative">
      {Array.from({ length: ghosts }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className={`bg-panel pointer-events-none absolute inset-0 rounded-lg border-2 transition-colors ${border}`}
          style={{
            transform: `translate(${(i + 1) * STACK_OFFSET_PX}px, ${-(i + 1) * STACK_OFFSET_PX}px)`,
            // Each card further back fades, which is what reads as depth --
            // identical layers just look like a thick border.
            opacity: (dead ? 0.5 : 1) * (1 - (i + 1) * 0.18),
          }}
        />
      ))}
      <div
        className={`bg-panel relative min-w-[152px] rounded-lg border-2 px-3 py-2.5 transition-colors ${border} ${
          dead ? "opacity-50" : ""
        }`}
      >
        <Handle type="target" position={Position.Left} />
        <div className="flex items-center gap-2">
          <Icon size={14} className={dead ? "text-fail" : "text-accent"} />
          <span className="text-chalk truncate text-[13px] font-medium">
            {component.label}
          </span>
        </div>
        <div className="text-fog mt-1 flex items-center gap-2 text-[10px]">
          <span>
            ×{component.instances}
            {(component.config.availabilityZones ?? 1) > 1 && (
              <span className="text-fog/70">
                {" "}
                · {component.config.availabilityZones} AZ
              </span>
            )}
          </span>
          {dead && <span className="text-fail font-medium">OFFLINE</span>}
        </div>

        {metrics && !dead && Number.isFinite(util) && (
          <div className="mt-1.5">
            <div className="bg-panel-2 h-1 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${
                  over ? "bg-fail" : hot ? "bg-warn" : "bg-pass"
                }`}
                style={{ width: `${Math.min(100, util * 100)}%` }}
              />
            </div>
            <div className="text-fog/70 mt-0.5 text-[9px]">
              {Math.round(util * 100)}% utilised
            </div>
          </div>
        )}
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
  )
}
