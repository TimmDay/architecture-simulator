# architecture-simulator

A personal tool for learning computer-science system architecture to a senior engineering
manager level.

Two modes sharing one topic taxonomy:

- **Drill** — typed-answer flashcards with SM-2 spaced repetition. Write the answer from
  memory, flip, compare against the model answer, grade yourself honestly.
- **Build** — a diagramming game. Take a scenario, drag components onto a canvas and wire
  them up, turn the traffic up, then break it on purpose.

Fail a rule in Build and the matching flashcards land at the front of tomorrow's Drill queue.
That loop is the product.

## Running it

```bash
pnpm install
pnpm dev
```

Then <http://localhost:3000>. **No configuration, no account, no API keys.** Progress is kept
in browser local storage.

```bash
pnpm test        # watch mode
pnpm check       # typecheck + tests, what CI runs
pnpm build       # production build
pnpm smoke       # real-browser smoke test (needs `pnpm dev` running in another terminal)
```

`pnpm build` writes to `.next-build`, not `.next`, so a production build can run
while `pnpm dev` is live without pulling the cache out from under it.

**If a page hangs on "Loading deck…", loses its styling, or 404s on
`layout.css` / `app-pages-internals.js`**, the dev cache is stale — installing a
dependency while the dev server is running will do it:

```bash
rm -rf .next && pnpm dev   # then hard-refresh the browser (⌘⇧R)
```

## Where things live

| Path | What |
| --- | --- |
| `SPEC.md` | The plan, and the reasoning behind every design decision |
| `src/topics.ts` | The shared taxonomy. `TopicId` is a union, not `string` — a typo is a compile error |
| `src/drill/` | Cards, SM-2 scheduling, queue policy |
| `src/drill/cards/` | The deck, one module per domain so a card is reviewable in a PR |
| `src/sim/` | The engine: `simulate()`, the rules, the component catalogue |
| `src/sim/scenarios/` | Scenario data plus each one's reference solution |
| `src/storage/` | `ProgressStore` — local today, Firestore when you're ready |
| `docs/FIRESTORE_SETUP.md` | How to move progress into Firestore and sync across devices |

The engine is pure: `simulate(graph, load, faults) → { metrics, verdicts }` has no React, no
network and no database, so everything the UI shows is a render of a testable function.

## Syncing progress across devices

Local storage means the deck on your laptop is not the deck on your tablet. `docs/FIRESTORE_SETUP.md`
is a ~20 minute walkthrough that fixes it. Until then, the app needs no setup at all — which is
the trade being made deliberately.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · `@xyflow/react` ·
vitest · pnpm. Deploys to Vercel.
