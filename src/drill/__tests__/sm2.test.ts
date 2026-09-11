import { describe, expect, it } from "vitest"
import { enqueueFromVerdict, isDue, newCardState, schedule } from "../sm2"

const at = (iso: string) => new Date(iso)

describe("SM-2 scheduling", () => {
  it("introduces a new card tomorrow on 'good'", () => {
    const s = schedule(newCardState("c"), "good", at("2026-01-01T09:00:00Z"))
    expect(s.intervalDays).toBe(1)
    expect(s.repetitions).toBe(1)
  })

  it("expands intervals as repetitions accumulate", () => {
    let s = newCardState("c")
    s = schedule(s, "good", at("2026-01-01T09:00:00Z"))
    expect(s.intervalDays).toBe(1)
    s = schedule(s, "good", at("2026-01-02T09:00:00Z"))
    expect(s.intervalDays).toBe(6)
    s = schedule(s, "good", at("2026-01-08T09:00:00Z"))
    expect(s.intervalDays).toBe(15) // 6 * 2.5
  })

  it("halves rather than resets on 'again', so one bad day does not erase months", () => {
    let s = newCardState("c")
    s = schedule(s, "good", at("2026-01-01T09:00:00Z"))
    s = schedule(s, "good", at("2026-01-02T09:00:00Z"))
    s = schedule(s, "good", at("2026-01-08T09:00:00Z"))
    expect(s.intervalDays).toBe(15)

    const lapsed = schedule(s, "again", at("2026-01-23T09:00:00Z"))
    expect(lapsed.intervalDays).toBe(8)
    expect(lapsed.lapses).toBe(1)
    // Ease is dented, not destroyed.
    expect(lapsed.easeFactor).toBeCloseTo(2.3, 5)
  })

  it("never drops ease below the floor", () => {
    let s = newCardState("c")
    for (let i = 0; i < 20; i++)
      s = schedule(s, "again", at("2026-01-01T09:00:00Z"))
    expect(s.easeFactor).toBe(1.3)
  })
})

describe("the Build -> Drill feedback loop", () => {
  it("pulls a card forward without corrupting its recall history", () => {
    let s = newCardState("cap-statement")
    s = schedule(s, "good", at("2026-01-01T09:00:00Z"))
    s = schedule(s, "good", at("2026-01-02T09:00:00Z"))
    const before = { ease: s.easeFactor, reps: s.repetitions, lapses: s.lapses }
    expect(isDue(s, at("2026-01-03T09:00:00Z"))).toBe(false)

    const pulled = enqueueFromVerdict(
      s,
      { scenarioId: "01-first-real-customers", ruleId: "topology.spof" },
      at("2026-01-03T09:00:00Z"),
    )

    // Due now...
    expect(isDue(pulled, at("2026-01-03T09:00:00Z"))).toBe(true)
    expect(pulled.enqueuedBy?.ruleId).toBe("topology.spof")
    // ...but the scheduling history is untouched. Failing to BUILD something is
    // not evidence that your recall record was wrong, and corrupting it here
    // would make the loop degrade the deck every time it fired.
    expect(pulled.easeFactor).toBe(before.ease)
    expect(pulled.repetitions).toBe(before.reps)
    expect(pulled.lapses).toBe(before.lapses)
  })

  it("clears the enqueue marker once the card is actually reviewed", () => {
    const pulled = enqueueFromVerdict(newCardState("c"), {
      scenarioId: "s",
      ruleId: "r",
    })
    expect(pulled.enqueuedBy).toBeDefined()
    expect(schedule(pulled, "good").enqueuedBy).toBeUndefined()
  })
})
