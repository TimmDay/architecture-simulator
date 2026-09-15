"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Users } from "lucide-react"
import { NodeButtons } from "./AddFromNode"

export type ClientNodeData = { rps: number }
export type ClientNodeType = Node<ClientNodeData, "client">

/**
 * The traffic source. Always present, never draggable from the palette -- it is
 * where load enters the graph, not a component the player chooses.
 */
export function ClientNode({ id, data }: NodeProps<ClientNodeType>) {
  return (
    <div className="border-accent/50 bg-accent/10 relative rounded-lg border-2 border-dashed px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-accent" />
        <span className="text-chalk text-[13px] font-medium">Users</span>
      </div>
      <div className="text-fog mt-0.5 text-[10px]">
        {Math.round(data.rps)} rps
      </div>
      <Handle type="source" position={Position.Right} />
      <NodeButtons nodeId={id} canBeTarget={false} />
    </div>
  )
}
