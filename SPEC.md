# Product spec: architecture-simulator

The plan. This is the first commit; everything after it implements this document.

## Goal

A personal web app that teaches computer-science **system architecture to a senior engineering manager level** — not "can you name a load balancer", but "can you defend this topology against a hostile reviewer, a traffic spike, a network partition, and a budget".

Two modes, one brain:

1. **Drill** — typed-answer flashcards with spaced repetition, covering the full topic taxonomy.
2. **Build** — a diagramming game. You're handed a scenario, you drag architecture components onto a canvas and wire them up, and the game then pressure-tests what you built: traffic slider, injected faults, security probes.

The two modes are joined by a **shared topic taxonomy**. Every flashcard and every simulator rule carries topic IDs. When your architecture fails a rule, the flashcards for that topic are pushed into your review deck. Failing to handle replica lag under load is what earns you the `consistency.read-your-writes` cards. That loop is the product.

## Stack

Inherited wholesale from `somnus-data-ingestion`, so there's nothing new to learn:

- **Next.js 15** App Router, **React 19**
- **TypeScript** strict (`noUncheckedIndexedAccess`, `checkJs`), `~/*` path alias to `src/`
- **Tailwind v4** via `@tailwindcss/postcss`
- **TanStack Query** for async state
- **zod** + **react-hook-form** + `@hookform/resolvers`
- **`@t3-oss/env-nextjs`** for env validation
- **lucide-react** icons
- **pnpm**, **vitest** + testing-library + happy-dom
- **eslint** + **prettier** (no semicolons, `prettier-plugin-tailwindcss`)
- **`@anthropic-ai/sdk`** — optional, see "Claude grading"

**Dropped from the somnus stack:** Cloudinary, MapLibre, onnxruntime-web, heic2any, `@imgly/background-removal`. No image pipeline, no maps.

**Added:**

- **`@xyflow/react`** (v12.11.x) for the canvas. Peer dep is `react: >=17`, so React 19 is clean. Gives typed nodes, typed edges with named handles, pan/zoom and a minimap out of the box — and its node/edge model maps one-to-one onto the component model below. The alternative (dnd-kit plus hand-rolled SVG edge routing) is a materially bigger build for the same result; rejected.
- **`firebase`** (v12.x, modular SDK — `firebase/app`, `firebase/firestore`, `firebase/auth` only) for persistence and identity.

**Deployment:** Vercel. **Persistence:** Cloud Firestore — see "Storage".

## Storage

All progress goes through one interface, so the backing store is never a decision the rest of the app has to know about.

```ts
interface ProgressStore {
  getCardStates(): Promise<CardState[]>
  saveCardState(state: CardState): Promise<void>
  getAttempts(scenarioId?: ScenarioId): Promise<ScenarioAttempt[]>
  saveAttempt(attempt: ScenarioAttempt): Promise<void>
  getSavedGraphs(): Promise<SavedGraph[]>
  saveGraph(graph: SavedGraph): Promise<void>
  exportAll(): Promise<ProgressSnapshot>
  importAll(snapshot: ProgressSnapshot): Promise<void>
}
```

**Backed by Cloud Firestore**, which is a deliberate departure from the somnus stack's Supabase/Postgres. The reasoning:

- **Offline persistence is built into the SDK.** Firestore keeps an IndexedDB-backed local cache and reconciles it with the server automatically. That means local-first *and* cross-device sync at the same time — the tension between "works offline / instant" and "the deck follows me to the tablet" simply doesn't arise, where with Supabase it would have been a real choice with a migration at the end of it.
- **The data is document-shaped.** Card states, scenario attempts and saved graphs are independent documents with no joins, no aggregate queries, no referential integrity to enforce. Postgres was never going to earn its keep here.
- **Anonymous auth means zero friction on day one.** `signInAnonymously` yields a stable UID with no login screen; linking a Google account later upgrades the same UID and keeps every card's history.

**Data model** — everything under the user's own document, so security rules are one line:

```
users/{uid}/cardStates/{cardId}      // SM-2 state per card
users/{uid}/attempts/{attemptId}     // one per scenario run, with verdicts + grade
users/{uid}/graphs/{graphId}         // saved architectures
users/{uid}/meta/profile             // settings, streaks, taxonomy mastery rollup
```

Security rules: `allow read, write: if request.auth.uid == uid`. Nothing is shared between users; there is no public surface.

**Cost/read discipline:** Firestore bills per document read, so the deck is fetched as *one* collection query per session (N document reads, ~200) and then held in TanStack Query — never a per-card round trip. Writes are one small document per graded card. That sits comfortably inside the free tier, but it's a design constraint worth stating rather than discovering.

**The `ProgressStore` interface stays regardless.** It's what makes this a one-file decision: Firestore is the implementation today, and if it disappoints, swapping to Supabase or plain IndexedDB touches nothing above the interface. `exportAll`/`importAll` still ship in Phase 1 — a JSON snapshot you own is worth having whoever hosts the data.

**Content is not in the database.** Flashcards, scenarios, component specs and rules are typed TS/JSON modules in the repo — diffable, reviewable in a PR, unit-testable, and adding a card is an edit, not a migration. Only *progress* is persisted.

## The topic taxonomy

The spine of the app. Stable string IDs, `domain.subtopic`. Both modes tag to them. Senior-EM scope means this deliberately includes cost and org topics, not just mechanics.

| Domain | Example topic IDs |
| --- | --- |
| `fundamentals` | `latency-numbers`, `throughput-vs-latency`, `percentiles`, `littles-law`, `universal-scalability` |
| `scaling` | `vertical-vs-horizontal`, `statelessness`, `session-affinity`, `autoscaling`, `connection-pooling` |
| `load-balancing` | `l4-vs-l7`, `algorithms`, `health-checks`, `anycast-and-dns` |
| `caching` | `cache-aside`, `write-through`, `invalidation`, `ttl-and-staleness`, `stampede`, `cdn`, `edge-caching` |
| `data-stores` | `relational-vs-document`, `kv-and-wide-column`, `graph`, `timeseries`, `indexing`, `denormalization` |
| `consistency` | `cap`, `pacelc`, `linearizability`, `causal`, `eventual`, `quorum-rw`, `read-your-writes`, `monotonic-reads` |
| `replication` | `leader-follower`, `multi-leader`, `leaderless`, `lag`, `failover`, `split-brain`, `rpo-rto` |
| `partitioning` | `strategies`, `consistent-hashing`, `hot-keys`, `rebalancing`, `cross-shard-queries` |
| `transactions` | `acid`, `isolation-levels`, `two-phase-commit`, `sagas`, `outbox`, `idempotency` |
| `messaging` | `queue-vs-log`, `delivery-semantics`, `ordering`, `backpressure`, `dlq`, `consumer-lag`, `fanout` |
| `styles` | `monolith`, `modular-monolith`, `microservices`, `event-driven`, `cqrs-es`, `serverless`, `cell-based` |
| `api` | `rest-grpc-graphql`, `versioning`, `pagination`, `gateway-and-bff`, `n-plus-one` |
| `reliability` | `slo-sli-error-budget`, `redundancy`, `failure-domains`, `circuit-breaker`, `retries-and-jitter`, `bulkheads`, `graceful-degradation`, `chaos` |
| `observability` | `metrics-logs-traces`, `red-and-use`, `cardinality`, `alerting-on-symptoms` |
| `security` | `authn-vs-authz`, `oauth-oidc-jwt`, `secrets`, `encryption-in-transit`, `encryption-at-rest`, `least-privilege`, `pii-and-residency`, `rate-limiting`, `ddos`, `zero-trust` |
| `delivery` | `blue-green`, `canary`, `feature-flags`, `expand-contract-migrations`, `iac` |
| `cost` | `unit-economics`, `egress`, `right-sizing`, `serverless-vs-reserved` |
| `org` | `conways-law`, `team-topologies`, `ownership-boundaries`, `build-vs-buy` |

## Mode 1 — Drill (flashcards)

**Card:** prompt, model answer, topic IDs, difficulty tier, optional "senior-EM framing" note (the trade-off conversation, not just the definition).

**Loop:** prompt shown → you type an answer into a textarea (no peeking, no multiple choice) → flip → your answer and the model answer sit **side by side** → you self-grade: **Again / Hard / Good / Easy**.

**Scheduling:** SM-2. `Again` re-queues the card later in the same session *and* resets its interval; `Hard`/`Good`/`Easy` schedule it forward with the usual ease-factor adjustment. Per-card state: `{ cardId, easeFactor, intervalDays, repetitions, dueAt, lapses, lastGrade }`.

**Views:** today's queue; free-study by topic or domain; a mastery grid showing per-topic strength, so weak domains are visible at a glance.

**Content target:** ~200 cards at v1, weighted toward `consistency`, `replication`, `messaging` and `reliability` — the domains the simulator leans on hardest.

### Claude grading (optional)

Self-grading is the default and always available with no key configured. With `ANTHROPIC_API_KEY` set, a per-session toggle sends your typed answer plus the model answer to an API route, and Claude returns a suggested grade, what you got right, and specifically what you omitted. It is a *second opinion* — you keep the final say on the grade, because self-assessment is part of the training. Absent the key, the toggle is disabled with an explanatory tooltip; the feature never blocks the core loop.

## Mode 2 — Build (the diagramming game)

### Typed components, not boxes

Every palette item is a typed spec, not a decorative rectangle. This is what makes the simulation gradable rather than vibes.

```ts
type ComponentKind =
  | "client" | "dns" | "cdn" | "load-balancer" | "api-gateway"
  | "app-server" | "worker" | "serverless-function"
  | "cache" | "sql-primary" | "sql-replica" | "nosql-node" | "shard-router"
  | "queue" | "log-stream" | "object-store" | "search-index"
  | "stream-processor" | "data-warehouse" | "config-service"

type ComponentSpec = {
  kind: ComponentKind
  capacityRps: number                          // per instance
  baseLatency: { p50Ms: number; p99Ms: number }
  stateful: boolean
  durable: boolean
  costPerInstanceHourUsd: number
  failureModes: FailureModeId[]
  supports: {
    replicas: boolean
    consistencyModes?: ConsistencyMode[]
    encryptionAtRest?: boolean
    autoscale?: boolean
  }
}

type ConsistencyMode = "strong" | "quorum" | "eventual"

type PlacedComponent = {
  id: string
  kind: ComponentKind
  label: string
  instances: number
  region: RegionId
  config: {
    consistency?: ConsistencyMode
    quorum?: { n: number; r: number; w: number }
    encryptedAtRest?: boolean
    authRequired?: boolean
    rateLimitRps?: number
    ttlSeconds?: number
    autoscale?: { minInstances: number; maxInstances: number }
    sessionStore?: "in-memory" | "shared" | "none"
  }
}
```

Consistency mode is in the model **from day one**, not bolted on later — without it, CAP cannot be drilled honestly (see below).

### Typed edges, not lines

An arrow from app→DB and an arrow from DB→replica mean entirely different things, and the engine has to know which.

```ts
type EdgeKind = "sync-request" | "async-publish" | "replication" | "cdc"

type Edge = {
  id: string
  from: string
  to: string
  kind: EdgeKind
  fanout?: number                              // downstream calls per inbound request
  replication?: { mode: "sync" | "async"; lagMs: number }
  timeoutMs?: number
  retries?: number
  jitter?: boolean
  circuitBreaker?: boolean
}
```

`fanout` is how the N+1 / chatty-services trap becomes measurable instead of rhetorical.

### One pure function

```ts
function simulate(input: {
  graph: ArchitectureGraph
  load: LoadProfile
  faults: FaultEvent[]
  scenario: Scenario
}): SimulationResult
```

Deterministic. No React, no network, no database. **Everything the UI renders is a view of this function's output** — which is what makes vitest meaningful in this repo, and what makes a score defensible rather than decorative. The engine lives in `src/sim/` and has no imports from `src/app/` or `src/components/`.

```ts
type SimulationResult = {
  metrics: {
    perComponent: Record<string, {
      offeredRps: number; capacityRps: number; utilization: number
      queueDepthApprox: number; p50Ms: number; p99Ms: number; droppedRps: number
    }>
    endToEnd: {
      p50Ms: number; p99Ms: number
      availability: number; errorRate: number
      estimatedMonthlyCostUsd: number
      staleReadWindowMs: number   // max over read paths of async replication lag + cache TTL
    }
  }
  verdicts: Verdict[]
}

type Verdict = {
  ruleId: string
  topicIds: TopicId[]
  severity: "info" | "warn" | "fail"
  title: string
  explanation: string
  componentIds: string[]
  remediationHint: string
}
```

**Fidelity model:** rule-based checks plus closed-form utilization maths — `ρ = λ/μ` per component, with latency inflating as `base × 1/(1 − ρ)` (clamped) and requests dropping once `ρ ≥ 1`. Offered load is propagated by graph traversal from the entry point, multiplied by each edge's `fanout` and reduced by cache hit ratios. Availability composes as a product along serial paths, with redundancy folding in as `1 − p^n` — but **only across independent failure domains**. Instances sharing a region, AZ or host collapse to a single unit for availability purposes, so fake redundancy earns no bonus, and the `resilience` rule that warns about a shared failure domain and the number on the scoreboard always agree. Correlated and cascading faults are likewise applied at failure-domain granularity, not per instance.

A full discrete-event simulator was considered and **rejected**: the closed-form model is enough for the traffic slider to feel real, is far cheaper to build, and — critically — stays deterministic and unit-testable. If the queueing approximation ever becomes the limiting factor on realism, it can be swapped behind the same `simulate` signature.

### The rules engine — and "launch security issues"

Rules are pure predicates over `(graph, metrics, scenario)` returning `Verdict[]`. Each is tagged with a category and topic IDs.

| Category | Example rules |
| --- | --- |
| `topology` | single point of failure; no LB in front of N app servers; orphaned component; write path through a read replica |
| `capacity` | component saturated (`ρ > 0.8`); no autoscaling under a spiky profile; unbounded fanout; missing connection pool |
| `consistency` | split-brain risk (two writable primaries, no consensus); read-your-writes violated via async replica; quorum `R + W ≤ N`; cache TTL exceeds the scenario's staleness budget |
| `resilience` | retries without jitter or a budget; no circuit breaker on a cross-service call; no DLQ on a consumer; shared failure domain across "redundant" instances |
| `security` | public endpoint with no authz; PII unencrypted at rest; no rate limiting at the edge; secrets on the instance; data leaves a restricted region |
| `cost` | over-provisioned for the load profile; always-on fleet under a bursty profile; cross-region egress on the hot path |
| `operability` | no observability on the critical path; no health checks feeding the LB |

**"Launch security issues" is this same engine with the `security` tag plus security-flavoured fault events** (credential-stuffing burst, unauthenticated endpoint probe, exfiltration-path trace) — *not* a second system. This is deliberate and it roughly halves the build.

### Scenarios

```ts
type Scenario = {
  id: ScenarioId
  title: string
  brief: string                                 // the product/business framing
  family: ArchitectureFamily
  level: 1 | 2 | 3 | 4 | 5
  requirements: {
    p99Ms: number
    availability: number                        // e.g. 0.999
    monthlyBudgetUsd: number
    durability: "best-effort" | "durable" | "geo-durable"
    consistency: "strong" | "read-your-writes" | "eventual"
    compliance?: ("pii" | "data-residency" | "pci")[]
  }
  loadProfiles: LoadProfile[]                   // what the traffic slider spans
  faultScript: FaultEvent[]                     // the pressure tests, in order
  declarations?: Declaration[]                  // see "Drilling CAP"
  availableKinds: ComponentKind[]               // palette is scoped per scenario
  topicIds: TopicId[]
}

type LoadProfile = {
  id: string
  label: string                                 // "Tuesday afternoon" / "Black Friday"
  rps: number
  readWriteRatio: number
  shape: "steady" | "diurnal" | "spiky" | "thundering-herd"
  geography: "single-region" | "multi-region" | "global"
}

type FaultEvent =
  | { kind: "node-down"; componentId: string }
  | { kind: "region-down"; region: RegionId }
  | { kind: "network-partition"; edgeId: string }
  | { kind: "latency-spike"; componentId: string; multiplier: number }
  | { kind: "traffic-spike"; multiplier: number }
  | { kind: "cache-flush"; componentId: string }
  | { kind: "poison-message"; componentId: string }
  | { kind: "credential-stuffing"; rps: number }
  | { kind: "unauthenticated-probe" }
```

### Drilling CAP honestly

A box-placement game cannot teach CAP. Two mechanisms make it real:

1. **`network-partition` targets a specific replication edge**, not "the system" — so the consequence depends on *which* link broke and how that store is configured.
2. **Declarations.** Before the partition fires, the scenario makes you commit: *"For the order store under a region-to-region partition — CP or AP? What does the user see?"*

```ts
type Declaration = {
  id: string
  prompt: string                                // "Region-to-region partition hits the order store..."
  askedBefore: FaultEvent["kind"]               // fires before this fault runs
  options: { id: string; label: string }[]      // e.g. CP / AP, plus the user-visible consequence
  // Ground truth is *derived*, never authored: the engine reads the player's graph
  // (consistency mode, quorum R/W/N, replication mode on the partitioned edge) and
  // computes what the system would actually do.
  derive: (graph: ArchitectureGraph, fault: FaultEvent) => string   // -> option id
  requiredBy: Scenario["requirements"]["consistency"]               // what the brief demanded
  topicIds: TopicId[]
}
```

Grading compares all three legs — declared, derived, required — and names which leg broke:
declaring AP while having configured synchronous quorum writes is *misreading your own system*;
declaring AP correctly against a `strong` requirement is *building the wrong system*. Those are
different lessons and you get told which one you just had.

This is also why `PACELC` is on the taxonomy: the else-branch (latency vs consistency when there's *no* partition) is graded on every run via `staleReadWindowMs`, not only during faults.

### Scenario catalogue (v1 target: 20)

Several per family, each with a different twist, so the same style gets attacked from more than one angle.

**Monolith & early scale (L1)**
1. *Ticketing SaaS, 500 seats* — the fundamentals: LB, app tier, DB, backups, health checks.
2. *The blog that hit the front page* — same shape, 50× read spike. CDN and cache-aside, or die.

**Modular monolith & vertical limits (L2)**
3. *The database is on fire* — write-heavy; read replicas and pooling, and replica lag surfaces read-your-writes.
4. *Reporting is killing prod* — OLTP/OLAP separation via CDC to a warehouse.

**Microservices (L2–L3)**
5. *Split the monolith* — service boundaries, gateway, and the N+1 fanout trap (`org.conways-law` gets tagged here).
6. *One celebrity account* — a hot key melts a shard.
7. *Checkout spans three services* — saga vs 2PC, outbox, idempotency keys.

**Event-driven & CQRS (L3)**
8. *Order pipeline on Black Friday* — backpressure, DLQ, consumer lag.
9. *The activity feed* — fanout-on-write vs fanout-on-read, and who pays.
10. *"Exactly-once", allegedly* — dedup and idempotency under retries.

**Serverless & edge (L3)**
11. *Bursty image API* — cold starts, concurrency limits, the cost crossover vs always-on.
12. *Edge personalization* — compute at the edge and the invalidation problem it creates.

**Multi-region (L4)**
13. *EU data residency* — regional isolation under a compliance constraint.
14. *Active-active, global writes* — multi-leader conflict resolution, LWW vs CRDT.
15. *The failover drill* — RPO/RTO, and the data you lose to async replication.
16. *Split-brain* — the flagship CAP scenario; partition between regions, declaration required.

**Data-intensive & streaming (L4–L5)**
17. *Realtime fraud scoring* — stream processing, windowing, late-arriving data.
18. *Clickstream to lakehouse* — batch vs stream, and backfill without downtime.
19. *Search that doesn't lag* — index sync via CDC, eventual consistency users can see.
20. *Noisy neighbour* — multi-tenant blast radius, cell-based architecture, bulkheads.

### Levelling up

Progressing a scenario family doesn't hand you a new brief — it makes the same physics harsher along three axes:

| Level | Traffic | SLO | Faults unlocked |
| --- | --- | --- | --- |
| 1 | steady, single region | 99% / p99 500ms | single node down |
| 2 | diurnal | 99.5% / p99 300ms | + traffic spike, latency spike |
| 3 | spiky | 99.9% / p99 200ms | + cache flush, poison message, dependency outage |
| 4 | multi-region | 99.95% / p99 150ms | + network partition, region down |
| 5 | global, thundering herd | 99.99% / p99 100ms | + correlated cascading failure, malicious traffic |

Budget tightens as levels rise, so the brute-force answer (add instances) stops working and the architectural answer is forced.

### Grading and the feedback loop

An attempt runs the scenario's load profiles and fault script through `simulate`, then grades each requirement independently — p99, availability, budget, durability, consistency, compliance — plus the declaration answers. Output is a per-requirement pass/fail with the actual numbers, the full verdict list ranked by severity, and a grade.

**Then the loop closes:** every failed verdict's `topicIds` enqueue the matching flashcards into the review deck, flagged with the scenario that earned them. Blow up a queue under Black Friday load and `messaging.backpressure` and `messaging.consumer-lag` are waiting in tomorrow's drill. This is the single most important integration in the app and it is why both modes share one taxonomy.

## Build phases

- **Phase 0 — Scaffold.** Next 15 + React 19 + Tailwind v4, tsconfig/eslint/prettier ported from somnus, vitest, `env.js` (with the `NEXT_PUBLIC_FIREBASE_*` config validated through zod, same pattern as somnus), Firebase project + Firestore + anonymous auth + security rules, app shell and nav, Vercel deploy, GitHub Actions CI (typecheck, lint, test).
- **Phase 1 — Drill, end to end.** Topic taxonomy module, SM-2 engine (pure + unit-tested), `ProgressStore` interface with the Firestore implementation, review UI with the typed-answer/flip/self-grade loop, mastery grid, JSON export/import. Ships with a **seed deck of ~40 cards** covering the taxonomy's spine — enough to use the loop for real.
- **Phase 1b — Content pass (parallel, ongoing).** The remaining ~160 cards. This is authoring, not engineering, and is deliberately split out so it never blocks the code: cards are Claude-drafted per topic, then reviewed by hand in batches of ~20 per PR. A card is only merged once its model answer has been read and corrected — an unreviewed deck teaches the wrong thing with full confidence.
- **Phase 2 — Claude grading.** API route, per-session toggle, graceful degradation with no key.
- **Phase 3 — Simulator core, headless.** `src/sim/`: component specs, graph types, `simulate`, the rules engine, fault application. Heavily unit-tested against fixture graphs. **No UI in this phase** — if the engine isn't right, the canvas is lipstick.
- **Phase 4 — Canvas.** `@xyflow/react` board, scoped palette, component config panel, typed edge creation, traffic slider wired live to `simulate`, metrics overlay. Three scenarios at L1–L2.
- **Phase 5 — Pressure.** Fault injection UI, the security probe, declarations and CAP grading, catalogue out to 20 scenarios, level progression.
- **Phase 6 — Close the loop.** Failed verdicts enqueue flashcards; a unified mastery dashboard spanning both modes.
- **Phase 7 — Account linking (optional).** Upgrade the anonymous UID to a real Google sign-in so progress survives a cleared browser profile, and add a settings screen over `exportAll`/`importAll`.

## Non-goals

- Provisioning or touching real infrastructure. Nothing here deploys anything.
- Packet-accurate or discrete-event simulation. The maths is deliberately closed-form.
- Multiplayer, leaderboards, or social features.
- Mobile-first design. The canvas is a desktop tool; the drill mode should merely survive a tablet.
- Being a general-purpose diagramming tool. The palette is scoped per scenario on purpose — constraint is pedagogy.
