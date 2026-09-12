import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SCENARIOS } from "~/sim/scenarios"
import { FEATURE_LABELS } from "~/sim/types"

const LEVEL_LABEL: Record<number, string> = {
  1: "Level 1 · foundations",
  2: "Level 2 · under load",
  3: "Level 3 · distributed",
  4: "Level 4 · multi-region",
  5: "Level 5 · global",
}

export default function ScenarioListPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-chalk text-2xl font-semibold tracking-tight">
        Pick a scenario
      </h1>
      <p className="text-fog mt-2 text-[14px] leading-relaxed">
        Each one assumes the lessons of the one before it. The palette is scoped
        deliberately — not everything offered belongs in the answer.
      </p>

      <div className="mt-8 space-y-3">
        {SCENARIOS.map((s) => (
          <Link
            key={s.id}
            href={`/build/${s.id}`}
            className="border-line bg-panel hover:border-accent/50 group block rounded-xl border p-5 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-fog/70 text-[11px] tracking-wide uppercase">
                  {LEVEL_LABEL[s.level] ?? `Level ${s.level}`}
                </div>
                <h2 className="text-chalk mt-1 text-[17px] font-medium">
                  {s.title}
                </h2>
                <p className="text-fog mt-1.5 line-clamp-2 text-[13px] leading-relaxed">
                  {s.brief.split("\n\n")[0]}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.features.map((f) => (
                    <span
                      key={f}
                      className="bg-panel-2 text-fog/80 rounded px-2 py-0.5 text-[10px]"
                    >
                      {FEATURE_LABELS[f]}
                    </span>
                  ))}
                </div>
              </div>
              <ArrowRight
                size={16}
                className="text-fog group-hover:text-accent mt-1 shrink-0 transition-colors"
              />
            </div>

            <dl className="border-line text-fog mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-[11px]">
              <div>
                p99{" "}
                <span className="text-chalk">≤ {s.requirements.p99Ms}ms</span>
              </div>
              <div>
                availability{" "}
                <span className="text-chalk">
                  ≥ {(s.requirements.availability * 100).toFixed(2)}%
                </span>
              </div>
              <div>
                budget{" "}
                <span className="text-chalk">
                  ≤ ${s.requirements.monthlyBudgetUsd}/mo
                </span>
              </div>
              <div>
                peak{" "}
                <span className="text-chalk">
                  {s.loadProfiles[
                    s.loadProfiles.length - 1
                  ]?.peakRps.toLocaleString()}{" "}
                  rps
                </span>
              </div>
              {s.requirements.compliance && (
                <div>
                  compliance{" "}
                  <span className="text-chalk">
                    {s.requirements.compliance.join(", ").toUpperCase()}
                  </span>
                </div>
              )}
            </dl>
          </Link>
        ))}
      </div>
    </div>
  )
}
