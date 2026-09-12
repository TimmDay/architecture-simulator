import { describe, expect, it } from "vitest"
import { stackLayers } from "../ComponentNode"

describe("instance stack", () => {
  it("draws nothing behind a single instance", () => {
    // The flat card must stay distinct -- "is this tier redundant?" is exactly
    // what the pile exists to answer without reading the number.
    expect(stackLayers(1)).toBe(0)
  })

  it("draws one card per extra instance", () => {
    expect(stackLayers(2)).toBe(1)
    expect(stackLayers(3)).toBe(2)
    expect(stackLayers(5)).toBe(4)
  })

  it("caps the pile so it cannot swamp its neighbours", () => {
    expect(stackLayers(9)).toBe(4)
    expect(stackLayers(50)).toBe(4)
  })

  it("survives a nonsense instance count without drawing negative cards", () => {
    expect(stackLayers(0)).toBe(0)
  })
})
