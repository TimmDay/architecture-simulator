"use client"

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import type { AttemptResult } from "~/sim/grade"
import { TOPICS } from "~/topics"

const GRADE_COLOR: Record<AttemptResult["grade"], string> = {
  A: "text-pass",
  B: "text-pass",
  C: "text-warn",
  D: "text-warn",
  F: "text-fail",
}

const SEVERITY = {
  fail: { icon: XCircle, cls: "text-fail border-fail/30 bg-fail/5" },
  warn: { icon: AlertTriangle, cls: "text-warn border-warn/30 bg-warn/5" },
  info: { icon: Info, cls: "text-accent border-accent/30 bg-accent/5" },
} as const

export function ResultsPanel({
  result,
  onEnqueueTopics,
  enqueued,
}: {
  result: AttemptResult
  onEnqueueTopics: () => void
  enqueued: boolean
}) {
  const failedTopicCount = new Set(
    result.verdicts
      .filter((v) => v.severity === "fail")
      .flatMap((v) => v.topicIds),
  ).size

  return (
    <div className="space-y-4">
      <div className="border-line bg-panel rounded-lg border p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-fog text-xs font-medium tracking-wide uppercase">
            Result
          </h3>
          <span
            className={`text-2xl font-semibold ${GRADE_COLOR[result.grade]}`}
          >
            {result.grade}
          </span>
        </div>

        <div className="divide-line mt-2 divide-y">
          {result.requirements.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between gap-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                {r.passed ? (
                  <CheckCircle2 size={13} className="text-pass shrink-0" />
                ) : (
                  <XCircle size={13} className="text-fail shrink-0" />
                )}
                <span className="text-chalk truncate text-[12px]">
                  {r.name}
                </span>
              </div>
              <span
                className={`shrink-0 text-[11px] ${r.passed ? "text-fog" : "text-fail"}`}
              >
                {r.actual}
                <span className="text-fog/50"> / {r.required}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {result.rounds.length > 0 && (
        <div className="border-line bg-panel rounded-lg border p-4">
          <h3 className="text-fog mb-2 text-xs font-medium tracking-wide uppercase">
            Pressure test
          </h3>
          {result.rounds.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className="text-chalk font-mono text-[11px]">
                {r.label}
              </span>
              <span
                className={`text-[11px] ${r.survived ? "text-pass" : "text-fail"}`}
              >
                {r.survived
                  ? "held"
                  : `broke · ${Math.round(r.result.metrics.endToEnd.errorRate * 100)}% errors`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-fog text-xs font-medium tracking-wide uppercase">
            Findings ({result.verdicts.length})
          </h3>
          {failedTopicCount > 0 && (
            <button
              onClick={onEnqueueTopics}
              disabled={enqueued}
              className="bg-accent/15 text-accent hover:bg-accent/25 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
            >
              {enqueued
                ? "Added to deck"
                : `Drill these ${failedTopicCount} topics`}
            </button>
          )}
        </div>

        {result.verdicts.length === 0 ? (
          <p className="text-pass border-pass/30 bg-pass/5 rounded-lg border px-3 py-2 text-[12px]">
            Nothing to flag. Every rule passed.
          </p>
        ) : (
          <div className="space-y-2">
            {result.verdicts.map((v, i) => {
              const { icon: Icon, cls } = SEVERITY[v.severity]
              return (
                <div
                  key={`${v.ruleId}-${i}`}
                  className={`rounded-lg border px-3 py-2.5 ${cls}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon size={13} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-chalk text-[12px] font-medium">
                        {v.title}
                      </div>
                      <p className="text-fog mt-1 text-[11px] leading-relaxed">
                        {v.explanation}
                      </p>
                      <p className="text-chalk/70 mt-1.5 text-[11px] leading-relaxed">
                        <span className="text-fog/60">Fix: </span>
                        {v.remediationHint}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {v.topicIds.map((t) => (
                          <span
                            key={t}
                            className="bg-panel-2 text-fog/80 rounded px-1.5 py-0.5 text-[9px]"
                          >
                            {TOPICS[t]?.label ?? t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
