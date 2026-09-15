/**
 * Pomodoro goals.
 *
 * A streak of days, each earned by finishing a set number of focus sessions.
 * The unit is the day, not the session: four sessions crammed into a Sunday is
 * not the habit this is trying to build, and a goal that could be satisfied
 * that way would quietly reward the opposite of what it is for.
 *
 * Progress is derived from the timer's own day-by-day history rather than
 * being counted separately, so there is nothing to keep in sync and nothing
 * that can be wrong while looking right.
 */

import { dayKey, completedOn, type TimerState } from "./pomodoro"

export type GoalDays = 3 | 7 | 14
export const GOAL_LENGTHS: GoalDays[] = [3, 7, 14]

export const MIN_POMS = 1
export const MAX_POMS = 10

export type Goal = {
  days: GoalDays
  /** Focus sessions needed in a day for that day to count. */
  pomsPerDay: number
  /** Day key the goal started on. */
  startedOn: string
}

export function newGoal(
  days: GoalDays,
  pomsPerDay: number,
  now = new Date(),
): Goal {
  return {
    days,
    pomsPerDay: Math.min(MAX_POMS, Math.max(MIN_POMS, Math.round(pomsPerDay))),
    startedOn: dayKey(now),
  }
}

function addDays(key: string, n: number): string {
  // Day keys are UTC (`dayKey` slices an ISO string), so stepping in UTC keeps
  // arithmetic and formatting on the same calendar.
  const d = new Date(key + "T00:00:00.000Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The calendar days the goal covers, in order. */
export function goalDayKeys(goal: Goal): string[] {
  return Array.from({ length: goal.days }, (_, i) => addDays(goal.startedOn, i))
}

export type DayProgress = {
  key: string
  poms: number
  /** The day's quota was met. */
  met: boolean
  /** The day has not arrived yet. */
  future: boolean
}

export type GoalProgress = {
  days: DayProgress[]
  met: number
  complete: boolean
}

export function goalProgress(
  goal: Goal,
  state: TimerState,
  now = new Date(),
): GoalProgress {
  const today = dayKey(now)
  const days = goalDayKeys(goal).map((key) => {
    const poms = completedOn(state, key)
    return { key, poms, met: poms >= goal.pomsPerDay, future: key > today }
  })
  const met = days.filter((d) => d.met).length
  return { days, met, complete: met === goal.days }
}
