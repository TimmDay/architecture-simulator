/**
 * Mix mode: mostly Speed, interrupted by the occasional Discuss card.
 *
 * The point is that recognising an answer among four and producing one from
 * nothing are different skills, and a session of only the first quietly
 * convinces you that you know things you cannot actually say out loud. Mix
 * keeps the volume of Speed while forcing you to produce an answer often
 * enough to catch that.
 */

/** Speed questions per Discuss card, on average. */
export const MIX_RATIO = 5

/**
 * How many Speed questions come before the next Discuss card.
 *
 * Drawn from {4, 5, 6} -- mean exactly MIX_RATIO -- rather than flipping a
 * 1-in-6 coin per question. A flat coin averages 5 too, but it also deals
 * runs: two Discuss cards back to back, or twenty Speed questions without
 * one. Neither is what "one in five" is meant to feel like.
 */
export function nextGap(random: () => number = Math.random): number {
  return MIX_RATIO - 1 + Math.floor(random() * 3)
}

export type MixState = {
  /** Speed questions answered since the last Discuss card. */
  answered: number
  /** How many to answer before the next one. */
  gap: number
}

export function startMix(random: () => number = Math.random): MixState {
  return { answered: 0, gap: nextGap(random) }
}

/**
 * Count a Speed question. Answering is what counts, not seeing -- skipping
 * past questions should not earn its way to a Discuss card.
 */
export function afterSpeed(state: MixState): MixState {
  return { ...state, answered: state.answered + 1 }
}

export function isDiscussDue(state: MixState): boolean {
  return state.answered >= state.gap
}

/** Reset the count and draw a fresh gap for the next stretch. */
export function afterDiscuss(
  _state: MixState,
  random: () => number = Math.random,
): MixState {
  return startMix(random)
}
