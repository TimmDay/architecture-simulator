import { describe, expect, it } from "vitest"
import { IDLE, type TimerState } from "../pomodoro"
import {
  MAX_POMS,
  MIN_POMS,
  goalDayKeys,
  goalProgress,
  newGoal,
} from "../goal"

const on = (day: string) => new Date(`${day}T12:00:00.000Z`)
const withHistory = (history: Record<string, number>): TimerState => ({
  ...IDLE,
  history,
})

describe("setting a goal", () => {
  it("starts today and covers the right calendar days", () => {
    const g = newGoal(3, 2, on("2026-03-01"))
    expect(g.startedOn).toBe("2026-03-01")
    expect(goalDayKeys(g)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"])
  })

  it("steps across a month boundary", () => {
    expect(goalDayKeys(newGoal(3, 1, on("2026-01-30")))).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
    ])
  })

  it("clamps the daily quota to the range the dialog offers", () => {
    expect(newGoal(7, 0).pomsPerDay).toBe(MIN_POMS)
    expect(newGoal(7, 99).pomsPerDay).toBe(MAX_POMS)
    expect(newGoal(7, 4.4).pomsPerDay).toBe(4)
  })
})

describe("progress", () => {
  const goal = newGoal(3, 2, on("2026-03-01"))

  it("counts a day only once its quota is met", () => {
    const p = goalProgress(
      goal,
      withHistory({ "2026-03-01": 2, "2026-03-02": 1 }),
      on("2026-03-02"),
    )
    expect(p.days.map((d) => d.met)).toEqual([true, false, false])
    expect(p.met).toBe(1)
    expect(p.complete).toBe(false)
  })

  it("does not carry surplus sessions into another day", () => {
    // Six in one sitting is not a three-day habit, and a goal that accepted it
    // would reward the opposite of what it is for.
    const p = goalProgress(goal, withHistory({ "2026-03-01": 6 }), on("2026-03-01"))
    expect(p.met).toBe(1)
    expect(p.complete).toBe(false)
  })

  it("completes when every day has met its quota", () => {
    const p = goalProgress(
      goal,
      withHistory({ "2026-03-01": 2, "2026-03-02": 3, "2026-03-03": 2 }),
      on("2026-03-03"),
    )
    expect(p.complete).toBe(true)
    expect(p.met).toBe(3)
  })

  it("marks days that have not arrived yet", () => {
    const p = goalProgress(goal, withHistory({}), on("2026-03-01"))
    expect(p.days.map((d) => d.future)).toEqual([false, true, true])
  })

  it("gives one dot per day of the goal", () => {
    for (const days of [3, 7, 14] as const) {
      const g = newGoal(days, 1, on("2026-03-01"))
      expect(goalProgress(g, withHistory({})).days).toHaveLength(days)
    }
  })
})
