import type { ArchitectureGraph } from "./types"
import { CLIENT_NODE_ID } from "./types"

/**
 * Place a graph on the canvas.
 *
 * Reference solutions are written as data -- components and edges, no
 * coordinates -- because where a box sits has nothing to do with whether the
 * design works. To show one, it has to be laid out.
 *
 * Longest-path layering: a component sits one column to the right of the
 * furthest-back thing that feeds it, so every arrow points forward and the
 * request path reads left to right. Longest path rather than shortest matters
 * when a component is reachable two ways -- a cache reached directly and also
 * through a router should sit after both, not beside the first one found.
 */

export const COLUMN_WIDTH = 240
export const ROW_HEIGHT = 150
const ORIGIN = { x: 40, y: 60 }

export type Positions = Record<string, { x: number; y: number }>

export function layoutGraph(graph: ArchitectureGraph): Positions {
  const depth = new Map<string, number>([[CLIENT_NODE_ID, 0]])

  // Relax until stable. Bounded by node count, so a cycle cannot spin forever.
  const rounds = graph.components.length + 2
  for (let i = 0; i < rounds; i++) {
    let changed = false
    for (const e of graph.edges) {
      const from = depth.get(e.from)
      if (from === undefined) continue
      const next = from + 1
      if (next > (depth.get(e.to) ?? -1)) {
        depth.set(e.to, next)
        changed = true
      }
    }
    if (!changed) break
  }

  // Anything the client cannot reach still has to go somewhere visible rather
  // than stacking on top of the entry point.
  const maxDepth = Math.max(0, ...[...depth.values()])
  for (const c of graph.components) {
    if (!depth.has(c.id)) depth.set(c.id, maxDepth + 1)
  }

  const columns = new Map<number, string[]>()
  for (const id of [CLIENT_NODE_ID, ...graph.components.map((c) => c.id)]) {
    const d = depth.get(id) ?? 0
    const col = columns.get(d) ?? []
    col.push(id)
    columns.set(d, col)
  }

  // Centre each column vertically against the tallest one, so the diagram reads
  // as a spine rather than as a staircase.
  const tallest = Math.max(...[...columns.values()].map((c) => c.length))
  const positions: Positions = {}
  for (const [d, ids] of columns) {
    const offset = ((tallest - ids.length) * ROW_HEIGHT) / 2
    ids.forEach((id, i) => {
      positions[id] = {
        x: ORIGIN.x + d * COLUMN_WIDTH,
        y: ORIGIN.y + offset + i * ROW_HEIGHT,
      }
    })
  }
  return positions
}
