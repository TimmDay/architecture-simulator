import Link from "next/link"
import { Boxes, Layers } from "lucide-react"
import { ALL_CARDS } from "~/drill/cards"
import { SCENARIOS } from "~/sim/scenarios"
import { ALL_TOPIC_IDS } from "~/topics"

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-chalk text-3xl font-semibold tracking-tight">
        Learn system architecture by defending it.
      </h1>
      <p className="text-fog mt-3 max-w-2xl text-[15px] leading-relaxed">
        Two modes over one topic taxonomy. Drill recalls the ideas; Build makes
        you apply them under load, faults and a budget. Fail a rule in Build and
        the matching cards land in tomorrow&apos;s Drill queue.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/drill"
          className="border-line bg-panel hover:border-accent/50 group rounded-xl border p-6 transition-colors"
        >
          <Layers className="text-accent" size={22} />
          <h2 className="text-chalk mt-4 text-lg font-medium">Drill</h2>
          <p className="text-fog mt-1.5 text-sm leading-relaxed">
            Type your answer, then judge it against the model answer. Spaced
            repetition does the scheduling.
          </p>
          <p className="text-fog/70 mt-4 text-xs">
            {ALL_CARDS.length} cards · {ALL_TOPIC_IDS.length} topics
          </p>
        </Link>

        <Link
          href="/build"
          className="border-line bg-panel hover:border-accent/50 group rounded-xl border p-6 transition-colors"
        >
          <Boxes className="text-accent" size={22} />
          <h2 className="text-chalk mt-4 text-lg font-medium">Build</h2>
          <p className="text-fog mt-1.5 text-sm leading-relaxed">
            Take a scenario, wire up an architecture, then turn the traffic up
            and start breaking things.
          </p>
          <p className="text-fog/70 mt-4 text-xs">
            {SCENARIOS.length} scenarios · levels 1–
            {Math.max(...SCENARIOS.map((s) => s.level))}
          </p>
        </Link>
      </div>

      <p className="text-fog/60 mt-10 text-xs leading-relaxed">
        Progress is stored in this browser only. See{" "}
        <code className="text-fog">docs/FIRESTORE_SETUP.md</code> to sync it
        across devices.
      </p>
    </div>
  )
}
