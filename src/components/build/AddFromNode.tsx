"use client"

import { createContext, useContext } from "react"
import { Plus } from "lucide-react"

/**
 * Lets a node ask the workspace to add something after it.
 *
 * A context rather than a prop threaded through node data: React Flow rebuilds
 * `data` on every metrics change, and putting a callback in there would make
 * every node re-render whenever any number moved.
 */
export const AddFromNodeContext = createContext<
  ((sourceId: string) => void) | null
>(null)

/**
 * The "+" on a node's outgoing edge.
 *
 * Only on small screens. With a mouse you drag from the palette and drag
 * between handles, which is quicker; with a thumb both of those are the two
 * gestures that do not work, so this is the whole build interaction.
 */
export function AddAfterButton({ nodeId }: { nodeId: string }) {
  const onAdd = useContext(AddFromNodeContext)
  if (!onAdd) return null
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onAdd(nodeId)
      }}
      // Without this the press starts a node drag and the tap never lands.
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      aria-label="Add a component after this one"
      className="border-accent/60 bg-panel text-accent hover:bg-accent/20 absolute top-1/2 -right-3.5 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border transition-colors sm:hidden"
    >
      <Plus size={14} />
    </button>
  )
}
