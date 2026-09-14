import { describe, expect, it } from "vitest"
import {
  BREAK_MINUTES,
  FOCUS_MINUTES,
  IDLE,
  dayKey,
  formatRemaining,
  remainingMinutes,
  start,
  stop,
  tabTitle,
  tick,
  type TimerState,
} from "../pomodoro"

const T0 = new Date("2026-03-01T09:00:00Z").getTime()
const mins = (n: number) => n * 60_000

describe("running a focus session", () => {
  it("counts down from the full length", () => {
    const s = start(IDLE, "focus", T0)
    expect(remainingMinutes(s, T0)).toBe(FOCUS_MINUTES)
    expect(formatRemaining(s, T0)).toBe("25:00")
  })

  it("shows 1 through the final minute rather than 0", () => {
    // A timer reading 0 for fifty-nine seconds looks broken.
    const s = start(IDLE, "focus", T0)
    expect(remainingMinutes(s, T0 + mins(24) + 1000)).toBe(1)
    expect(remainingMinutes(s, T0 + mins(25))).toBe(0)
  })

  it("is unaffected by how often it is ticked", () => {
    // The whole point of an absolute end time: a throttled background tab is
    // one that redraws less often, not one that loses minutes.
    const s = start(IDLE, "focus", T0)
    const ticked = tick(tick(s, T0 + mins(1)), T0 + mins(20))
    expect(remainingMinutes(ticked, T0 + mins(20))).toBe(5)
    const never = start(IDLE, "focus", T0)
    expect(remainingMinutes(never, T0 + mins(20))).toBe(5)
  })

  it("finishes into a done state and counts the session", () => {
    const s = tick(start(IDLE, "focus", T0), T0 + mins(FOCUS_MINUTES))
    expect(s.phase).toBe("done")
    expect(s.completedToday).toBe(1)
    expect(s.endsAt).toBeNull()
  })

  it("does not count a session that was stopped early", () => {
    const s = tick(stop(start(IDLE, "focus", T0)), T0 + mins(30))
    expect(s.phase).toBe("idle")
    expect(s.completedToday).toBe(0)
  })
})

describe("breaks", () => {
  it("runs shorter and returns quietly to idle", () => {
    const base: TimerState = { ...IDLE, countedOn: dayKey(new Date(T0)) }
    const started = start(base, "break", T0)
    expect(remainingMinutes(started, T0)).toBe(BREAK_MINUTES)
    const after = tick(started, T0 + mins(BREAK_MINUTES))
    expect(after.phase).toBe("idle")
    // Nobody needs congratulating for having stopped working.
    expect(after.completedToday).toBe(0)
  })
})

describe("the daily count", () => {
  it("accumulates across sessions on the same day", () => {
    let s: TimerState = { ...IDLE, countedOn: dayKey(new Date(T0)) }
    s = tick(start(s, "focus", T0), T0 + mins(25))
    s = tick(start(s, "focus", T0 + mins(30)), T0 + mins(55))
    expect(s.completedToday).toBe(2)
  })

  it("resets itself the next day without anyone clearing it", () => {
    const yesterday: TimerState = {
      ...IDLE,
      completedToday: 2,
      countedOn: "2026-02-28",
    }
    expect(tick(yesterday, T0).completedToday).toBe(0)
  })
})

describe("the tab title", () => {
  it("shows the time left, so a backgrounded timer is still visible", () => {
    const s = start(IDLE, "focus", T0)
    expect(tabTitle(s, "Architecture Simulator", T0 + mins(5))).toBe(
      "20:00 — Architecture Simulator",
    )
  })

  it("announces the break when the session ends", () => {
    const s = tick(start(IDLE, "focus", T0), T0 + mins(25))
    expect(tabTitle(s, "Architecture Simulator")).toContain("Break time")
  })

  it("leaves the title alone when nothing is running", () => {
    expect(tabTitle(IDLE, "Architecture Simulator")).toBe(
      "Architecture Simulator",
    )
  })
})
