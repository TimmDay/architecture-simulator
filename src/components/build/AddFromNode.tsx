"use client"

import { createContext, useContext } from "react"
import { Plug, Plus } from "lucide-react"

export type NodeActions = {
  /** Open the menu of things that could come after this node. */
  onAdd: (sourceId: string) => void
  /** The node a connection is being drawn from, or null. */
  connectingFrom: string | null
  startConnect: (sourceId: string) => void
  finishConnect: (targetId: string) => void
  /** Whether this node can be the other end of the connection in progress. */
  canReceive: (targetId: string) => boolean
}

/**
 * Lets a node talk to the workspace.
 *
 * A context rather than props threaded through node data: React Flow rebuilds
 * `data` on every metrics change, and a callback in there would re-render every
 * node whenever any number moved.
 */
export const NodeActionsContext = createContext<NodeActions | null>(null)

/**
 * The buttons on a node: add after, and connect to.
 *
 * Small screens only. With a mouse you drag from the palette and drag between
 * handles; with a thumb neither works -- a real touch drag from one handle to
 * another produces no edge at all -- so on a phone these are the whole
 * interaction.
 *
 * Connecting is two taps rather than a drag: a green plug on the source, then
 * a red plug on every node that could receive it. Nothing is dragged, both
 * targets are thumb-sized, and the direction is stated by which plug you
 * pressed first rather than by which way you happened to move.
 */
export function NodeButtons({
  nodeId,
  canBeTarget,
}: {
  nodeId: string
  /** False for the traffic source: load enters there, it never receives. */
  canBeTarget: boolean
}) {
  const actions = useContext(NodeActionsContext)
  if (!actions) return null
  const { onAdd, connectingFrom, startConnect, finishConnect, canReceive } =
    actions

  // Stop the press reaching the node, or it starts a drag and the tap is lost.
  const swallow = {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  }

  if (connectingFrom) {
    if (connectingFrom === nodeId || !canBeTarget || !canReceive(nodeId)) {
      return null
    }
    return (
      <button
        {...swallow}
        onClick={(e) => {
          e.stopPropagation()
          finishConnect(nodeId)
        }}
        aria-label="Connect to this component"
        className="border-fail bg-fail/25 text-fail animate-pulse absolute -bottom-3 -left-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border sm:hidden"
      >
        <Plug size={13} />
      </button>
    )
  }

  return (
    <>
      <button
        {...swallow}
        onClick={(e) => {
          e.stopPropagation()
          onAdd(nodeId)
        }}
        aria-label="Add a component after this one"
        className="border-accent/60 bg-panel text-accent hover:bg-accent/20 absolute top-1/2 -right-3.5 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border transition-colors sm:hidden"
      >
        <Plus size={14} />
      </button>
      <button
        {...swallow}
        onClick={(e) => {
          e.stopPropagation()
          startConnect(nodeId)
        }}
        aria-label="Connect this component to another"
        className="border-pass/70 bg-panel text-pass hover:bg-pass/20 absolute -right-3 -bottom-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-colors sm:hidden"
      >
        <Plug size={13} />
      </button>
    </>
  )
}
