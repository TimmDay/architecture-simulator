import Link from "next/link"
import { Boxes, Layers } from "lucide-react"
import { ALL_CARDS } from "~/drill/cards"
import { SCENARIOS } from "~/sim/scenarios"
import { ALL_TOPIC_IDS } from "~/topics"
import { DONATE_URL, REPO_URL } from "~/lib/donate"
import { CircuitMotif } from "~/components/CircuitMotif"

const link =
  "text-accent hover:text-chalk underline underline-offset-2 transition-colors"

export default function HomePage() {
  return (
    /*
      `overflow-x-clip` because the glow below is wider than the page on
      purpose -- a radial that stops at the viewport edge draws a visible seam.
      `my-auto` rather than `items-center` on the flex parent: auto margins
      collapse to nothing once the content is taller than the space, which is
      the phone case (the content runs to ~1400px against an 844px screen).
      Centring it the other way would push the top of the hero above the
      scroll origin, where it cannot be reached.
    */
    <div className="relative my-auto w-full overflow-x-clip px-6 py-16 sm:py-20">
      {/*
        No negative z-index. `body` paints an opaque background and does not
        create a stacking context, so a -z-10 child renders BEHIND that
        background and is simply never seen. Instead the glow stays at the
        default level and the content below is `relative`, which puts it later
        in the paint order.
      */}
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[32rem]"
      />
      <div className="relative">
        {/*
        Centred, and capped at the width prose is actually comfortable to read.
        It used to be left-aligned at 672px inside an 848px column, so every
        paragraph stopped 176px short of where the cards ended -- which is what
        made a properly centred page feel off-centre. Widening the text to meet
        the cards would have fixed the edge and cost the readability: 15px type
        at 848px runs past a hundred characters a line.
      */}
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-chalk text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            Learn system architecture by defending it.
          </h1>
          <p className="text-chalk/80 mt-6 text-lg leading-relaxed text-balance">
            Made redundant and need to study for interviews? I&apos;m with ya.
          </p>
          {/* Left-aligned on a phone. Centring a four-line paragraph across
            342px costs more in readability than it buys in symmetry -- the eye
            has to hunt for the start of every line. The heading and the lead
            are short enough to stay centred. */}
          <p className="text-fog mt-4 text-left text-[15px] leading-relaxed text-pretty sm:text-center">
            Drill recalls the ideas. Build makes you apply them under load,
            faults and a budget — fail a rule in Build and the matching cards
            land in tomorrow&apos;s Drill queue.
          </p>
        </header>

        {/* Sits directly above the cards so the trace lands on them. It picks
          its own shape from the breakpoint -- a fork when they sit side by
          side, a single stem when they stack. */}
        <CircuitMotif className="mx-auto mt-8 sm:mt-10" />

        <div className="mx-auto mt-2 grid max-w-4xl gap-4 sm:grid-cols-2">
          <Link
            href="/drill"
            className="border-line bg-panel/80 hover:border-accent/50 hover:bg-panel group rounded-xl border p-6 transition-colors"
          >
            <Layers className="text-accent" size={22} />
            <h2 className="text-chalk mt-4 text-lg font-medium">Drill</h2>
            <p className="text-fog mt-1.5 text-sm leading-relaxed">
              Multiple choice or discuss. Learn the vocab to defend your
              architecture choices.
            </p>
            <p className="text-fog/70 mt-4 text-xs">
              {ALL_CARDS.length} cards · {ALL_TOPIC_IDS.length} topics
            </p>
          </Link>

          <Link
            href="/build"
            className="border-line bg-panel/80 hover:border-accent/50 hover:bg-panel group rounded-xl border p-6 transition-colors"
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

        {/*
        What used to be one ninety-word paragraph carrying six separate claims.
        Three of them said the same thing -- "free and local", "stays in your
        browser", and a closing line repeating that progress is stored in this
        browser only -- so they are now stated once.
      */}
        <div className="border-line/60 mx-auto mt-16 grid max-w-4xl gap-6 border-t pt-8 text-[13px] leading-relaxed sm:grid-cols-3">
          <div>
            <h3 className="text-chalk/90 font-medium">Free, and yours</h3>
            <p className="text-fog mt-1.5">
              No account, no cookies, nothing identifying. Your progress stays
              in this browser.
            </p>
          </div>
          <div>
            <h3 className="text-chalk/90 font-medium">No ads, ever</h3>
            <p className="text-fog mt-1.5">
              {DONATE_URL ? (
                <a
                  href={DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                >
                  Buy me a coffee
                </a>
              ) : (
                "Buy me a coffee"
              )}{" "}
              if you want to affirm my f u to ads — noting that yes, I am
              redundant.
            </p>
          </div>
          <div>
            <h3 className="text-chalk/90 font-medium">Open source</h3>
            <p className="text-fog mt-1.5">
              It&apos;s{" "}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                on GitHub
              </a>
              . Fork it for your own study, or just use it as is. I might even
              review an issue.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
