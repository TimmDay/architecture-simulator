import { describe, expect, it } from "vitest"
import { CORE_CARDS } from "../cards"
import { band, domainStrengths, topicStrengths } from "../progress"
import type { TopicStrength } from "../progress"

const t = (topic: string, domain: string, strength: number) =>
  ({ topic, domain, strength, cards: 1, seen: 1, weight: 2 }) as TopicStrength

describe("banding", () => {
  it("splits at the same thresholds the chips are coloured by", () => {
    expect(band(0)).toBe("weak")
    expect(band(0.25)).toBe("weak")
    expect(band(0.26)).toBe("medium")
    expect(band(0.66)).toBe("medium")
    expect(band(0.67)).toBe("strong")
  })
})

describe("rolling topics up to domains", () => {
  it("counts each band and averages the strength", () => {
    const rows = domainStrengths([
      t("a", "consistency", 0.9),
      t("b", "consistency", 0.5),
      t("c", "consistency", 0.1),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ strong: 1, medium: 1, weak: 1 })
    expect(rows[0]!.strength).toBeCloseTo(0.5, 5)
  })

  it("puts the weakest domain first, so the page answers the only question asked of it", () => {
    const rows = domainStrengths([
      t("a", "consistency", 0.9),
      t("b", "caching", 0.1),
      t("c", "scaling", 0.5),
    ])
    expect(rows.map((r) => r.domain)).toEqual([
      "caching",
      "scaling",
      "consistency",
    ])
  })

  it("sorts topics inside a domain weakest first too", () => {
    const rows = domainStrengths([
      t("a", "consistency", 0.9),
      t("b", "consistency", 0.2),
    ])
    expect(rows[0]!.topics.map((x) => x.topic)).toEqual(["b", "a"])
  })

  it("accounts for every topic in the real deck", () => {
    const strengths = topicStrengths(CORE_CARDS, new Map())
    const rows = domainStrengths(strengths)
    const total = rows.reduce((n, r) => n + r.topics.length, 0)
    expect(total).toBe(strengths.length)
    // Nothing studied, so everything lands in `weak` and nothing is lost.
    expect(rows.reduce((n, r) => n + r.weak, 0)).toBe(strengths.length)
  })
})
