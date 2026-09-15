import type { Card, CardState } from "./types"
import { cardWeight } from "./queue"
import { isDue } from "./sm2"
import {
  topicWeight,
  DOMAINS,
  TOPICS,
  type DomainId,
  type TopicId,
} from "~/topics"

/**
 * Reading a deck's history back.
 *
 * All of this is derived from CardState, which already recorded everything --
 * it was simply never shown. The one thing that had to be added was Speed
 * history, because recognition was being used to reschedule and then discarded.
 */

export type Coverage = {
  total: number
  seen: number
  dueNow: number
  dueThisWeek: number
  /** Reviewed at least once and not lapsing: the deck you can actually rely on. */
  solid: number
}

export function coverage(
  cards: Card[],
  states: Map<string, CardState>,
  now = new Date(),
): Coverage {
  const week = new Date(now.getTime() + 7 * 86_400_000)
  let seen = 0
  let dueNow = 0
  let dueThisWeek = 0
  let solid = 0
  for (const card of cards) {
    const s = states.get(card.id)
    if (!s) continue
    if (s.lastReviewedAt) seen++
    if (isDue(s, now)) dueNow++
    else if (new Date(s.dueAt) <= week) dueThisWeek++
    if (s.repetitions >= 2 && s.intervalDays >= 7) solid++
  }
  return { total: cards.length, seen, dueNow, dueThisWeek, solid }
}

export type Struggle = {
  card: Card
  state: CardState
  /** Higher means it needs more attention. */
  score: number
  reason: string
}

/**
 * Cards that need a tighter recall frequency than the schedule alone gives.
 *
 * SM-2 already shortens intervals when you forget, but it does so quietly, so a
 * card you have failed six times looks identical in the queue to one you have
 * never missed. Surfacing them is the point: these are where study time
 * actually pays, and a handful of them account for most of the frustration in
 * any deck.
 *
 * Weighted by interview importance, because a leech on a topic nobody asks
 * about is not worth the same attention as one on CAP.
 */
export function struggling(
  cards: Card[],
  states: Map<string, CardState>,
  limit = 12,
): Struggle[] {
  const out: Struggle[] = []
  for (const card of cards) {
    const s = states.get(card.id)
    // Studied at all, by any route. Checking `repetitions` alone excluded the
    // worst cards: a grade of "again" resets it to zero, so a card forgotten
    // six times looked exactly like one never opened.
    const studied = s && (s.lastReviewedAt !== null || (s.speedSeen ?? 0) > 0)
    if (!s || !studied) continue

    const attempts = s.repetitions + s.lapses
    const lapseRate = attempts > 0 ? s.lapses / attempts : 0
    // Ease falls as you forget; 2.5 is the starting point and 1.3 the floor.
    const easePenalty = (2.5 - s.easeFactor) / 1.2
    const speedSeen = s.speedSeen ?? 0
    const speedMissRate =
      speedSeen >= 3 ? 1 - (s.speedRight ?? 0) / speedSeen : 0

    const score =
      (lapseRate * 2 + easePenalty + speedMissRate) *
      (0.6 + cardWeight(card) * 0.2)
    if (score <= 0.15) continue

    const reason =
      s.lapses >= 3
        ? `forgotten ${s.lapses} times`
        : speedMissRate > 0.4
          ? `missed ${speedSeen - (s.speedRight ?? 0)} of ${speedSeen} in Speed`
          : s.easeFactor <= 1.9
            ? "ease has dropped — it keeps needing a reset"
            : `forgotten ${s.lapses} time${s.lapses === 1 ? "" : "s"}`

    out.push({ card, state: s, score, reason })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * Where a topic sits. The same three bands the dashboard colours by, named
 * once so the roll-up and the chips cannot drift apart.
 */
export const STRONG = 0.66
export const MEDIUM = 0.25

export type Band = "strong" | "medium" | "weak"

export function band(strength: number): Band {
  return strength > STRONG ? "strong" : strength > MEDIUM ? "medium" : "weak"
}

export type DomainStrength = {
  domain: DomainId
  label: string
  topics: TopicStrength[]
  strong: number
  medium: number
  weak: number
  /** Mean strength across the domain's topics, for ordering. */
  strength: number
}

/**
 * Topics rolled up to their domain.
 *
 * The dashboard used to print all 166 topics as a flat wall of chips, which is
 * unreadable precisely when you most need it -- there is no answer to "where am
 * I weakest" in a list that long. Domains are the unit a study session is
 * actually chosen at, so the summary is per domain and the topics live behind
 * it. Weakest first, because that is the only ordering anyone scans for.
 */
export function domainStrengths(strengths: TopicStrength[]): DomainStrength[] {
  const acc = new Map<DomainId, DomainStrength>()
  for (const t of strengths) {
    const row = acc.get(t.domain) ?? {
      domain: t.domain,
      label: DOMAINS[t.domain],
      topics: [],
      strong: 0,
      medium: 0,
      weak: 0,
      strength: 0,
    }
    row.topics.push(t)
    row[band(t.strength)] += 1
    acc.set(t.domain, row)
  }
  for (const row of acc.values()) {
    row.strength =
      row.topics.reduce((n, t) => n + t.strength, 0) / row.topics.length
    row.topics.sort((a, b) => a.strength - b.strength)
  }
  return [...acc.values()].sort((a, b) => a.strength - b.strength)
}

export type TopicStrength = {
  topic: TopicId
  domain: DomainId
  strength: number
  cards: number
  seen: number
  weight: number
}

/**
 * Per-topic strength, replacing the earlier interval-only measure.
 *
 * Interval alone overstates a card you have forgotten repeatedly and then
 * relearned: the interval climbs back while the ease factor -- the honest
 * record of how hard it has been -- stays low. Both are needed, and an unseen
 * card counts as zero rather than being left out, so an untouched topic reads
 * as weak rather than as absent.
 */
export function topicStrengths(
  cards: Card[],
  states: Map<string, CardState>,
): TopicStrength[] {
  const acc = new Map<TopicId, { total: number; sum: number; seen: number }>()
  for (const card of cards) {
    const s = states.get(card.id)
    const reviewed = s && s.repetitions > 0
    const intervalPart = reviewed ? Math.min(1, s.intervalDays / 21) : 0
    const easePart = reviewed
      ? Math.min(1, Math.max(0, (s.easeFactor - 1.3) / 1.2))
      : 0
    const strength = reviewed ? intervalPart * 0.6 + easePart * 0.4 : 0
    for (const t of card.topicIds) {
      const prev = acc.get(t) ?? { total: 0, sum: 0, seen: 0 }
      acc.set(t, {
        total: prev.total + 1,
        sum: prev.sum + strength,
        seen: prev.seen + (reviewed ? 1 : 0),
      })
    }
  }
  return [...acc].map(([topic, v]) => ({
    topic,
    domain: TOPICS[topic].domain,
    strength: v.total === 0 ? 0 : v.sum / v.total,
    cards: v.total,
    seen: v.seen,
    weight: topicWeight(topic),
  }))
}

/**
 * Where to spend the next hour: weak, and asked about often.
 *
 * A weak topic nobody asks about is not urgent; a strong one they always ask
 * about is not either. The product of the two is what ranks.
 */
export function priorities(
  strengths: TopicStrength[],
  limit = 8,
): TopicStrength[] {
  return [...strengths]
    .filter((t) => t.weight >= 2)
    .sort((a, b) => (1 - b.strength) * b.weight - (1 - a.strength) * a.weight)
    .slice(0, limit)
}

/** How many cards fall due on each of the next `days` days. */
export function dueForecast(
  cards: Card[],
  states: Map<string, CardState>,
  days = 14,
  now = new Date(),
): number[] {
  const buckets = new Array<number>(days).fill(0)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  for (const card of cards) {
    const s = states.get(card.id)
    if (!s || s.repetitions === 0) continue
    const day = Math.floor(
      (new Date(s.dueAt).getTime() - startOfToday.getTime()) / 86_400_000,
    )
    // Anything overdue counts as today -- it is work waiting now, not history.
    const index = Math.max(0, day)
    if (index < days) buckets[index] = (buckets[index] ?? 0) + 1
  }
  return buckets
}
