import { describe, expect, it } from "vitest"
import {
  BREAK_MINUTES,
  FOCUS_MINUTES,
  IDLE,
  dayKey,
  completedOn,
  completedToday,
  formatRemaining,
  isPaused,
  pause,
  remainingMinutes,
  remainingMs,
  resume,
  start,
  stop,
  tabTitle,
  tick,
  togglePause,
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
    expect(completedToday(s, T0)).toBe(1)
    expect(s.endsAt).toBeNull()
  })

  it("does not count a session that was stopped early", () => {
    const s = tick(stop(start(IDLE, "focus", T0)), T0 + mins(30))
    expect(s.phase).toBe("idle")
    expect(completedToday(s, T0)).toBe(0)
  })
})

describe("pausing", () => {
  it("holds the time left rather than a moment in time", () => {
    const s = pause(start(IDLE, "focus", T0), T0 + mins(5))
    expect(isPaused(s)).toBe(true)
    expect(s.endsAt).toBeNull()
    expect(remainingMs(s, T0 + mins(5))).toBe(mins(20))
    // An hour later it has still lost nothing -- a pause has no end until you
    // resume it, so wall-clock time must not touch it.
    expect(remainingMs(s, T0 + mins(65))).toBe(mins(20))
  })

  it("resumes into a fresh end timestamp", () => {
    const paused = pause(start(IDLE, "focus", T0), T0 + mins(5))
    const back = resume(paused, T0 + mins(20))
    expect(isPaused(back)).toBe(false)
    expect(back.endsAt).toBe(T0 + mins(40))
    expect(remainingMinutes(back, T0 + mins(20))).toBe(20)
  })

  it("never finishes while paused, however long it is left", () => {
    // The bug that matters: ticking a paused timer past its ORIGINAL end would
    // count a focus session the user did not sit through.
    const paused = pause(start(IDLE, "focus", T0), T0 + mins(5))
    const ticked = tick(paused, T0 + mins(90))
    expect(ticked.phase).toBe("focus")
    expect(completedToday(ticked, T0 + mins(90))).toBe(0)
    expect(remainingMs(ticked, T0 + mins(90))).toBe(mins(20))
  })

  it("survives a reload, which is how the component rehydrates it", () => {
    const paused = pause(start(IDLE, "focus", T0), T0 + mins(5))
    const reloaded = tick(
      JSON.parse(JSON.stringify(paused)) as TimerState,
      T0 + mins(40),
    )
    expect(isPaused(reloaded)).toBe(true)
    expect(remainingMinutes(reloaded, T0 + mins(40))).toBe(20)
  })

  it("toggles both ways", () => {
    const running = start(IDLE, "focus", T0)
    const off = togglePause(running, T0 + mins(1))
    const on = togglePause(off, T0 + mins(3))
    expect(isPaused(off)).toBe(true)
    expect(isPaused(on)).toBe(false)
    expect(remainingMinutes(on, T0 + mins(3))).toBe(24)
  })

  it("clears the hold when stopped, so the next session starts clean", () => {
    const s = start(
      stop(pause(start(IDLE, "focus", T0), T0 + mins(5))),
      "focus",
      T0 + mins(10),
    )
    expect(s.pausedMs).toBeNull()
    expect(remainingMinutes(s, T0 + mins(10))).toBe(FOCUS_MINUTES)
  })

  it("does nothing to a timer that is not running", () => {
    expect(pause(IDLE)).toBe(IDLE)
    expect(resume(IDLE)).toBe(IDLE)
  })

  it("says so in the tab title", () => {
    const s = pause(start(IDLE, "focus", T0), T0 + mins(5))
    expect(tabTitle(s, "Architecture Simulator", T0 + mins(30))).toBe(
      "Paused 20:00 — Architecture Simulator",
    )
  })
})

describe("breaks", () => {
  it("runs shorter and returns quietly to idle", () => {
    const started = start(IDLE, "break", T0)
    expect(remainingMinutes(started, T0)).toBe(BREAK_MINUTES)
    const after = tick(started, T0 + mins(BREAK_MINUTES))
    expect(after.phase).toBe("idle")
    // Nobody needs congratulating for having stopped working.
    expect(completedToday(after, T0)).toBe(0)
  })
})

describe("the daily count", () => {
  it("accumulates across sessions on the same day", () => {
    let s: TimerState = IDLE
    s = tick(start(s, "focus", T0), T0 + mins(25))
    s = tick(start(s, "focus", T0 + mins(30)), T0 + mins(55))
    expect(completedToday(s, T0)).toBe(2)
  })

  it("rolls over on its own, because a new day has no key yet", () => {
    const yesterday: TimerState = { ...IDLE, history: { "2026-02-28": 2 } }
    expect(completedToday(yesterday, T0)).toBe(0)
    // And yesterday is still on the record, which is what a goal is built on.
    expect(completedOn(yesterday, "2026-02-28")).toBe(2)
  })

  it("keeps every day, so a fortnight-long goal has something to read", () => {
    let s: TimerState = IDLE
    s = tick(start(s, "focus", T0), T0 + mins(25))
    const dayTwo = T0 + 864e5
    s = tick(start(s, "focus", dayTwo), dayTwo + mins(25))
    expect(Object.keys(s.history)).toHaveLength(2)
    expect(completedOn(s, dayKey(new Date(T0)))).toBe(1)
    expect(completedOn(s, dayKey(new Date(dayTwo)))).toBe(1)
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
