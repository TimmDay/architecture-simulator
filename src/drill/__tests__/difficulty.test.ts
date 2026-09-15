import { describe, expect, it } from "vitest"
import { ALL_CARDS } from "../cards"
import {
  DIFFICULTY_FILTERS,
  difficultyCounts,
  difficultyOf,
  filterByDifficulty,
} from "../difficulty"
import type { Card } from "../types"

const card = (id: string, tier: 1 | 2 | 3): Card => ({
  id,
  prompt: id,
  answer: id,
  topicIds: ["consistency.cap"],
  tier,
  speed: [],
})

describe("difficulty", () => {
  it("names each tier", () => {
    expect(difficultyOf(card("a", 1))).toBe("easy")
    expect(difficultyOf(card("b", 2))).toBe("mid")
    expect(difficultyOf(card("c", 3))).toBe("tricky")
  })

  it("selects one level, and `all` selects everything", () => {
    const deck = [card("a", 1), card("b", 2), card("c", 3), card("d", 1)]
    expect(filterByDifficulty(deck, "easy").map((c) => c.id)).toEqual([
      "a",
      "d",
    ])
    expect(filterByDifficulty(deck, "tricky").map((c) => c.id)).toEqual(["c"])
    expect(filterByDifficulty(deck, "all")).toBe(deck)
  })

  it("offers every level, `all` last", () => {
    expect(DIFFICULTY_FILTERS.map(([v]) => v)).toEqual([
      "easy",
      "mid",
      "tricky",
      "all",
    ])
  })

  it("leaves no level of the real deck empty", () => {
    // A filter that selects nothing is a broken control, so this is a ratchet:
    // it fails if a re-tiering pass ever empties a level out.
    const counts = difficultyCounts(ALL_CARDS)
    expect(counts.easy).toBeGreaterThan(0)
    expect(counts.mid).toBeGreaterThan(0)
    expect(counts.tricky).toBeGreaterThan(0)
    expect(counts.all).toBe(counts.easy + counts.mid + counts.tricky)
  })
})
