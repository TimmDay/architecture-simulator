import { describe, expect, it } from "vitest"
import { gradeAttempt } from "../grade"
import { SCENARIOS } from "../scenarios"
import type { ArchitectureGraph, Edge } from "../types"

/**
 * "See a solution" loads the reference onto the canvas, so the canvas has to be
 * able to express it. It could not: every edge was hardcoded to a synchronous
 * request with fixed retries and no circuit breaker, so a solution that gets
 * slow work off the request path came back graded F -- the shown answer
 * contradicted the test asserting it passes.
 *
 * These guard the seam. The canvas carries edge kind, carries, fanout, timeout
 * and circuit breaker; anything a reference needs beyond that is invisible once
 * drawn, and a reference that depends on it would mislead.
 */
const CANVAS_EDGE_KINDS = new Set(["sync-request", "async-publish"])

/** What survives a round trip through the canvas. */
function asDrawn(graph: ArchitectureGraph): ArchitectureGraph {
  return {
    components: graph.components,
    edges: graph.edges
      .filter((e) => CANVAS_EDGE_KINDS.has(e.kind))
      .map((e): Edge => ({
        id: e.id,
        from: e.from,
        to: e.to,
        kind: e.kind,
        carries: e.carries ?? "all",
        fanout: e.fanout ?? 1,
        timeoutMs: e.timeoutMs ?? 2000,
        circuitBreaker: e.circuitBreaker ?? false,
        retries: 2,
        jitter: true,
      })),
  }
}

describe.each(SCENARIOS)("$title", (scenario) => {
  it("still passes every requirement once drawn on the canvas", () => {
    const drawn = gradeAttempt(asDrawn(scenario.reference), scenario)
    const failed = drawn.requirements.filter((r) => !r.passed)
    expect(
      failed,
      `shown solution fails: ${failed.map((f) => `${f.name} ${f.actual}`).join("; ")}`,
    ).toEqual([])
  })

  it("grades the same drawn as it does as authored", () => {
    // If these diverge, the picture on screen is not the thing CI verified.
    expect(gradeAttempt(asDrawn(scenario.reference), scenario).grade).toBe(
      gradeAttempt(scenario.reference, scenario).grade,
    )
  })

  it("uses only edge kinds the canvas can draw on the request path", () => {
    // Replication and CDC are modelled but not drawn. A reference may use them
    // for realism, but no requirement may depend on one, or the shown design
    // would be a different design.
    const hidden = scenario.reference.edges.filter(
      (e) => !CANVAS_EDGE_KINDS.has(e.kind),
    )
    for (const e of hidden) {
      expect(["replication", "cdc"]).toContain(e.kind)
    }
  })
})
