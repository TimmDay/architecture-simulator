"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Check, Layers, Target, TrendingUp } from "lucide-react"
import { ALL_CARDS, CORE_CARDS } from "~/drill/cards"
import {
  coverage,
  dueForecast,
  priorities,
  struggling,
  topicStrengths,
} from "~/drill/progress"
import type { CardState } from "~/drill/types"
import { getProgressStore } from "~/storage"
import type { ScenarioAttempt } from "~/storage/types"
import { scenarioById } from "~/sim/scenarios"
import { recommend, scenarioProgress } from "~/sim/study-plan"
import { DOMAINS, TOPICS, type DomainId } from "~/topics"

export function ProgressDashboard() {
  const [states, setStates] = useState<Map<string, CardState> | null>(null)
  const [attempts, setAttempts] = useState<ScenarioAttempt[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const store = getProgressStore()
      const [cardStates, saved] = await Promise.all([
        store.getCardStates(),
        store.getAttempts(),
      ])
      if (cancelled) return
      setStates(new Map(cardStates.map((s) => [s.cardId, s])))
      setAttempts(saved)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const recommendation = useMemo(
    () => recommend(scenarioProgress(attempts)),
    [attempts],
  )

  const data = useMemo(() => {
    if (!states) return null
    const strengths = topicStrengths(CORE_CARDS, states)
    return {
      cover: coverage(CORE_CARDS, states),
      vocab: coverage(
        ALL_CARDS.filter((c) => c.deck === "vocabulary"),
        states,
      ),
      weak: struggling(ALL_CARDS, states),
      strengths,
      next: priorities(strengths),
      forecast: dueForecast(ALL_CARDS, states),
      speed: ALL_CARDS.reduce(
        (acc, c) => {
          const s = states.get(c.id)
          return {
            seen: acc.seen + (s?.speedSeen ?? 0),
            right: acc.right + (s?.speedRight ?? 0),
          }
        },
        { seen: 0, right: 0 },
      ),
    }
  }, [states])

  if (!data) {
    return (
      <div className="text-fog mx-auto max-w-5xl px-6 py-20 text-sm">
        Reading your history…
      </div>
    )
  }

  const { cover, vocab, weak, strengths, next, forecast, speed } = data
  const nothingYet = cover.seen === 0 && speed.seen === 0

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-chalk text-2xl font-semibold tracking-tight">
        Progress
      </h1>
      <p className="text-fog mt-2 text-[14px]">
        Everything here is read back from what you have already done — nothing
        is estimated.
      </p>

      {recommendation && (
        <section className="border-accent/30 bg-accent/5 mt-6 rounded-xl border p-5">
          <div className="text-accent flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase">
            <Target size={13} /> Do this next
          </div>
          <Link
            href={`/build/${recommendation.scenario.id}`}
            className="text-chalk hover:text-accent mt-2 block text-[17px] font-medium transition-colors"
          >
            {recommendation.scenario.title}
            <span className="text-fog ml-2 text-[12px] font-normal">
              level {recommendation.scenario.level}
            </span>
          </Link>
          <p className="text-fog mt-1.5 text-[13px] leading-relaxed">
            {recommendation.detail}
          </p>
          {recommendation.failedRuleIds.length > 0 && (
            <p className="text-fog/70 mt-2 text-[11px]">
              Last time it flagged:{" "}
              {recommendation.failedRuleIds.slice(0, 3).join(", ")}
            </p>
          )}
        </section>
      )}

      {nothingYet ? (
        <div className="border-line bg-panel mt-8 rounded-xl border p-8 text-center">
          <Layers className="text-fog mx-auto" size={26} />
          <h2 className="text-chalk mt-4 text-lg font-medium">
            Nothing to show yet
          </h2>
          <p className="text-fog mx-auto mt-2 max-w-md text-sm leading-relaxed">
            Answer some cards and this fills in — what you have seen, what is
            holding, and which cards keep slipping away.
          </p>
          <Link
            href="/drill"
            className="bg-accent/15 text-accent hover:bg-accent/25 mt-5 inline-block rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Start drilling
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <Stat
              label="Concepts seen"
              value={`${cover.seen}/${cover.total}`}
              sub={`${cover.solid} holding`}
            />
            <Stat
              label="Vocabulary seen"
              value={`${vocab.seen}/${vocab.total}`}
            />
            <Stat
              label="Due now"
              value={String(cover.dueNow)}
              sub={`${cover.dueThisWeek} this week`}
            />
            <Stat
              label="Speed accuracy"
              value={
                speed.seen > 0
                  ? `${Math.round((speed.right / speed.seen) * 100)}%`
                  : "—"
              }
              sub={speed.seen > 0 ? `${speed.seen} answered` : undefined}
            />
          </div>

          {weak.length > 0 && (
            <section className="mt-10">
              <h2 className="text-chalk flex items-center gap-2 text-[15px] font-medium">
                <AlertTriangle size={15} className="text-warn" /> Needs a
                tighter recall frequency
              </h2>
              <p className="text-fog mt-1 text-[12px] leading-relaxed">
                Spaced repetition already shortens these intervals, but it does
                so quietly — a card you have failed six times looks the same in
                the queue as one you have never missed. This is where study time
                actually pays.
              </p>
              <div className="mt-3 space-y-2">
                {weak.map(({ card, reason }) => (
                  <div
                    key={card.id}
                    className="border-line bg-panel rounded-lg border px-3.5 py-2.5"
                  >
                    <div className="text-chalk text-[13px] leading-snug">
                      {card.speed[0]?.question ?? card.prompt}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-warn text-[11px]">{reason}</span>
                      <span className="text-fog/50 text-[11px]">
                        · {TOPICS[card.topicIds[0]!]?.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {next.length > 0 && (
            <section className="mt-10">
              <h2 className="text-chalk flex items-center gap-2 text-[15px] font-medium">
                <Target size={15} className="text-accent" /> Where the next hour
                pays most
              </h2>
              <p className="text-fog mt-1 text-[12px]">
                Weak, and asked about often. A weak topic nobody asks about is
                not urgent.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {next.map((t) => (
                  <div
                    key={t.topic}
                    className="border-line bg-panel flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-chalk truncate text-[12px]">
                        {TOPICS[t.topic].label}
                      </div>
                      <div className="bg-panel-2 mt-1.5 h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-accent h-full rounded-full"
                          style={{ width: `${Math.max(2, t.strength * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-fog/60 shrink-0 text-[10px]">
                      {t.weight === 3 ? "asked often" : "asked sometimes"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-chalk flex items-center gap-2 text-[15px] font-medium">
              <TrendingUp size={15} className="text-accent" /> Coming up
            </h2>
            <p className="text-fog mt-1 text-[12px]">
              Reviews falling due over the next fortnight. Anything overdue
              counts as today.
            </p>
            <div className="border-line bg-panel mt-3 flex h-28 items-end gap-1 rounded-lg border p-3">
              {forecast.map((count, i) => {
                const tallest = Math.max(1, ...forecast)
                return (
                  <div
                    key={i}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div
                      title={`${count} due`}
                      className={`w-full rounded-sm ${i === 0 ? "bg-accent" : "bg-accent/35"}`}
                      style={{
                        height: `${Math.max(2, (count / tallest) * 72)}px`,
                      }}
                    />
                    <span className="text-fog/50 text-[9px]">
                      {i === 0 ? "now" : i}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          <StrengthGrid strengths={strengths} />

          <section className="mt-10">
            <h2 className="text-chalk flex items-center gap-2 text-[15px] font-medium">
              <Check size={15} className="text-pass" /> Scenarios
            </h2>
            <div className="mt-3 space-y-1.5">
              {scenarioProgress(attempts).map((p) => (
                <Link
                  key={p.scenario.id}
                  href={`/build/${p.scenario.id}`}
                  className="border-line bg-panel hover:border-accent/50 flex items-center gap-3 rounded-lg border px-3 py-2 text-[12px] transition-colors"
                >
                  <span className="text-fog/60 w-10 shrink-0">
                    L{p.scenario.level}
                  </span>
                  <span className="text-chalk min-w-0 flex-1 truncate">
                    {p.scenario.title}
                  </span>
                  {p.attempts === 0 ? (
                    <span className="text-fog/50 shrink-0">not attempted</span>
                  ) : (
                    <span
                      className={`shrink-0 ${p.passed ? "text-pass" : "text-warn"}`}
                    >
                      {p.passed ? "passed" : "not passed"} · best {p.bestGrade}{" "}
                      · {p.attempts} {p.attempts === 1 ? "try" : "tries"}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>

          {attempts.length > 0 && (
            <section className="mt-10">
              <h2 className="text-fog text-[13px] font-medium">
                Recent attempts
              </h2>
              <div className="mt-3 space-y-1.5">
                {attempts.slice(0, 10).map((a) => (
                  <div
                    key={a.id}
                    className="border-line bg-panel flex items-center gap-3 rounded-lg border px-3 py-2 text-[12px]"
                  >
                    <span
                      className={`w-5 font-semibold ${a.passed ? "text-pass" : "text-fail"}`}
                    >
                      {a.grade}
                    </span>
                    <span className="text-chalk min-w-0 flex-1 truncate">
                      {scenarioById(a.scenarioId)?.title ?? a.scenarioId}
                    </span>
                    <span className="text-fog/60 shrink-0">
                      {new Date(a.at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="border-line bg-panel rounded-lg border px-3.5 py-3">
      <div className="text-fog text-[11px]">{label}</div>
      <div className="text-chalk mt-0.5 text-xl font-semibold">{value}</div>
      {sub && <div className="text-fog/60 text-[10px]">{sub}</div>}
    </div>
  )
}

function StrengthGrid({
  strengths,
}: {
  strengths: ReturnType<typeof topicStrengths>
}) {
  const domains = Object.keys(DOMAINS) as DomainId[]
  return (
    <section className="mt-10">
      <h2 className="text-chalk text-[15px] font-medium">Every topic</h2>
      <p className="text-fog mt-1 text-[12px]">
        Strength combines how long a card has held with how hard it has been — a
        card relearned five times should not look like one never forgotten.
      </p>
      <div className="mt-3 space-y-4">
        {domains.map((d) => {
          const inDomain = strengths
            .filter((t) => t.domain === d)
            .sort((a, b) => a.strength - b.strength)
          if (inDomain.length === 0) return null
          return (
            <div key={d}>
              <h3 className="text-fog mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                {DOMAINS[d]}
              </h3>
              <div className="flex flex-wrap gap-1">
                {inDomain.map((t) => (
                  <span
                    key={t.topic}
                    title={`${TOPICS[t.topic].label} — ${Math.round(t.strength * 100)}% (${t.seen}/${t.cards} cards seen)`}
                    className="border-line rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      borderColor:
                        t.strength > 0.66
                          ? "rgb(74 222 128 / 0.5)"
                          : t.strength > 0.25
                            ? "rgb(251 191 36 / 0.5)"
                            : undefined,
                      color:
                        t.strength > 0.66
                          ? "rgb(74 222 128)"
                          : t.strength > 0.25
                            ? "rgb(251 191 36)"
                            : undefined,
                    }}
                  >
                    {TOPICS[t.topic].label}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
