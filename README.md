<h1 align="center">Architecture Simulator</h1>

<p align="center">
  <strong>Learn system architecture by defending it.</strong><br>
  System diagramming with a traffic simulation slide.
</p>

<p align="center">
  <a href="https://architecture-simulator-five.vercel.app"><strong>Live app →</strong></a>
  &nbsp;·&nbsp;
  <a href="SPEC.md">Design notes</a>
  &nbsp;·&nbsp;
  <img src="https://github.com/TimmDay/architecture-simulator/actions/workflows/ci.yml/badge.svg" alt="CI">
</p>

<p align="center">
  <img src="docs/img/build.png" alt="A payments and OCR architecture graded A, having survived three fault rounds" width="100%">
</p>

---

## What it is

Interview prep tool for system architecture design.

**Build** diagram to a scenario with hard requirements — p99 under 400ms, 99.9% available, under $900 a month — and a scoped palette. Drag components out, wire them together, then attack the result: raise the traffic, kill a node, flush the cache, poison a queue, run a security probe. You get a grade and a list of findings.

**Drill** is flash cards: 204 cards across 166 topics, in multiple choice for volume or typed-answer for the real thing, on an SM-2 schedule.

**The loop is the product.** Fail a rule in Build and the matching cards land at the front of tomorrow's Drill queue.

<p align="center">
  <img src="docs/img/drill.png" alt="The drill screen in speed mode" width="100%">
</p>


## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict, `noUncheckedIndexedAccess`) · Tailwind v4 · `@xyflow/react` · vitest · Playwright · pnpm · Vercel.

**242 tests.** No accounts, no API keys, no backend — progress lives in browser storage behind a `ProgressStore` interface, with a Firestore implementation a swap away.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

```bash
pnpm check        # typecheck + tests, what CI runs
pnpm test         # watch mode
pnpm build        # production build, exactly as Vercel runs it
pnpm build:local  # same, but writes to .next-build so a live dev server survives
pnpm smoke        # real-browser test (needs `pnpm dev` in another terminal)
```

<details>
<summary><strong>Where things live</strong></summary>

<br>

| Path                       | What                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `SPEC.md`                  | The plan, and the reasoning behind every design decision                            |
| `src/topics.ts`            | The shared taxonomy. `TopicId` is a union, not `string` — a typo is a compile error |
| `src/sim/simulate.ts`      | The engine. Flow propagation, latency, availability, cost                           |
| `src/sim/rules.ts`         | The 34 rules that produce findings, each tagged with the topics it teaches          |
| `src/sim/scenarios/`       | Scenario data plus each one's reference solution                                    |
| `src/sim/observability.ts` | The observability probe — findings derived by comparing fault rounds to baseline    |
| `src/drill/`               | Cards, SM-2 scheduling, queue policy, progress                                      |
| `src/drill/cards/`         | The deck, one module per domain so a card is reviewable in a PR                     |
| `src/storage/`             | `ProgressStore` — local today, Firestore when you want it                           |

</details>

<details>
<summary><strong>Gotchas</strong></summary>

<br>

**Use `pnpm build:local` if `pnpm dev` is running.** A plain `next build` writes to `.next` and replaces the dev server's cache underneath it, leaving the running app 404ing on `layout.css`. `build` itself is deliberately plain, because Vercel runs it and expects output in `.next`.

**If a page hangs on "Loading deck…" or loses its styling**, the dev cache is stale — installing a dependency while the dev server runs will do it:

```bash
rm -rf .next && pnpm dev   # then hard-refresh (⌘⇧R)
```

**Progress is per browser.** [`docs/FIRESTORE_SETUP.md`](docs/FIRESTORE_SETUP.md) is a ~20 minute walkthrough to sync it across devices. Until then the app needs no setup at all, which is the trade being made deliberately.

</details>

## Licence

MIT — see [LICENSE](LICENSE). Fork it and make it your own.

Free and ad-free. If it helped, [buy me a coffee](https://ko-fi.com/timmday).
