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

  return (
    <div
      className={`bg-panel min-w-[152px] rounded-lg border-2 px-3 py-2.5 transition-colors ${border} ${
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
  )
}
