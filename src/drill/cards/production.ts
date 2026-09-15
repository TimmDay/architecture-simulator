import type { Card } from "../types"

export const productionCards: Card[] = [
  {
    id: "testing-pyramid",
    prompt:
      "Distinguish unit, integration and end-to-end tests by what each one actually proves, and why the balance between them matters.",
    answer:
      "A unit test proves one piece of logic behaves as specified, in isolation, in milliseconds. An integration test proves your code works against a real collaborator — a database, a queue, an HTTP client — catching the wiring, serialisation and query mistakes that mocks hide. An end-to-end test proves a whole user journey works through the deployed system, which is the only proof that the pieces fit, and is also slow, flaky and expensive to diagnose. The balance matters because the fast tests tell you precisely what broke while the slow ones only tell you that something did.",
    emFraming:
      "The failure mode to manage is the inverted pyramid: a large end-to-end suite that takes forty minutes, fails intermittently, and is therefore re-run rather than read. At that point the suite has stopped being a signal and has become a tax.",
    topicIds: ["delivery.testing-pyramid"],
    tier: 1,
    speed: [
      {
        question:
          "What does an integration test prove that a unit test cannot?",
        correct:
          "That your code works against a real collaborator — the wiring, queries and serialisation",
        distractors: [
          "That a whole user journey works through the deployed system",
          "That the logic is correct for edge cases and error paths",
          "That the system performs acceptably under concurrent load",
        ],
      },
    ],
  },
  {
    id: "blue-green",
    prompt:
      "How does a blue/green deployment work, and what does it not protect you from?",
    answer:
      "Two complete production environments. Blue serves traffic while green is deployed and verified; you then cut traffic over at the router or load balancer, and blue stays untouched as an instant rollback target. The cutover is atomic and the rollback is a second cut. What it does not protect you from is anything shared between the two — above all the database. A migration that green needs and blue cannot read makes the rollback impossible, which is the thing people discover during the incident.",
    emFraming:
      "This is why schema changes have to be expand-contract: deploy a schema both versions can work against, ship the code, then remove the old shape in a later release. Blue/green buys you a rollback only if the data layer is backward compatible.",
    topicIds: [
      "delivery.blue-green",
      "delivery.expand-contract-migrations",
      "delivery.rollback",
    ],
    tier: 1,
    speed: [
      {
        question: "What does blue/green NOT protect you from?",
        correct:
          "A destructive schema migration — the old version can no longer read the database",
        distractors: [
          "A bad release reaching all users at once",
          "A slow rollback while instances restart",
          "Configuration drift between the two environments",
        ],
      },
      {
        question: "What makes blue/green's rollback instant?",
        correct:
          "The old environment is still running and untouched — you cut traffic back",
        distractors: [
          "The previous container image is cached on every host",
          "Deployments are applied as a reversible database transaction",
          "Traffic is mirrored to both environments during the cutover",
        ],
      },
    ],
  },
  {
    id: "canary-release",
    prompt:
      "How does a canary release work, and what has to exist for it to be worth doing?",
    answer:
      "Route a small share of real traffic — 1%, then 5%, then 25% — to the new version while the rest stays on the old one, comparing error rate and latency between the two at each step, and promoting or aborting based on the comparison. What it requires is observability that can distinguish the two populations: metrics labelled by version, and agreed thresholds decided in advance. Without that you are not running a canary, you are doing a slow deploy and hoping somebody notices.",
    emFraming:
      "The value is bounding the blast radius: a bad release harms 1% of users for ten minutes instead of everyone for an hour. The cost is that both versions run simultaneously, so the code and the data they share must tolerate that.",
    topicIds: [
      "delivery.canary",
      "observability.metrics-logs-traces",
      "reliability.slo-sli-error-budget",
    ],
    tier: 1,
    speed: [
      {
        question: "What must exist for a canary to be worth doing?",
        correct:
          "Metrics labelled by version, and thresholds agreed before you start",
        distractors: [
          "A separate environment identical to production",
          "A feature flag wrapping every changed code path",
          "Automated rollback triggered by any error in the new version",
        ],
      },
    ],
  },
  {
    id: "rollback-mechanics",
    prompt:
      "What makes a rollback actually possible, and what commonly makes it impossible?",
    answer:
      "It is possible when the previous artifact still exists and can run correctly against the current state of the world — the database schema, the message formats, the feature flags, the caches. It becomes impossible when the new version has changed shared state irreversibly: a destructive migration, a message published in a format the old consumer cannot parse, a cache populated with new-format entries. Rolling back code is trivial; rolling back data is usually not, so the real discipline is making every deploy forward-compatible so the old version can still cope.",
    emFraming:
      "Worth asking before any risky release: what exactly do we do if this is wrong, and has anyone tried it? A rollback plan nobody has rehearsed is the same category of belief as an untested backup.",
    topicIds: [
      "delivery.rollback",
      "delivery.expand-contract-migrations",
      "delivery.blue-green",
    ],
    tier: 1,
    speed: [
      {
        question: "What most commonly makes a rollback impossible?",
        correct:
          "The new version changed shared state irreversibly — a destructive migration or a new message format",
        distractors: [
          "The previous container image has already been garbage collected",
          "The deploy pipeline only moves forward, never backward",
          "Traffic has already been cut over at the load balancer",
        ],
      },
    ],
  },
  {
    id: "feature-flags",
    prompt:
      "How do feature flags decouple deployment from release, and what do they cost?",
    answer:
      "Deploying ships the code; the flag decides whether anyone can reach it. That lets you merge continuously, deploy dark, enable for internal users, ramp gradually, and turn a feature off in seconds without a deploy — which is a far faster remedy than a rollback. The costs are real: every flag doubles the paths through the code and the combinations multiply, flags left in place become permanent untested branches, and the flag system itself becomes a dependency on the critical path that must fail to a sane default.",
    emFraming:
      "Treat a flag as having a removal date from the day it is created. The failure mode is not any single flag but a codebase with two hundred of them, where nobody knows which combinations have ever actually run.",
    topicIds: ["delivery.feature-flags", "delivery.canary"],
    tier: 1,
    speed: [
      {
        question: "What do feature flags cost you?",
        correct:
          "Every flag doubles the paths through the code, and stale ones become untested branches",
        distractors: [
          "A deploy for every change to who can see the feature",
          "The ability to roll back, since the flag state is not versioned",
          "Latency, because each request must check the flag service synchronously",
        ],
      },
    ],
  },
  {
    id: "state-vs-compute",
    prompt:
      "What does it mean to separate authoritative state from compute capacity, and why is it the precondition for most scaling?",
    answer:
      "Authoritative state is the system of record — the database, the object store, the log. It is expensive to scale, needs careful failover, and losing it is unrecoverable. Compute is the servers and workers that read and transform it: they hold nothing that cannot be reconstructed, so they can be added, removed, restarted or killed freely. Separating the two means you can scale the expensive-but-cheap-to-add half independently, deploy without risk to the data, and treat instances as disposable. Blur it — sessions in memory, files on local disk, work queued inside a process — and every instance becomes precious.",
    emFraming:
      "It is also what makes the cost conversation tractable: compute flexes with load and is the dial you turn, state grows with the business and is the one you plan. Products that cannot tell them apart cannot do either.",
    topicIds: [
      "reliability.state-vs-compute",
      "scaling.statelessness",
      "scaling.autoscaling",
    ],
    tier: 1,
    speed: [
      {
        question: "What makes compute 'interchangeable' in this sense?",
        correct:
          "It holds nothing that cannot be reconstructed, so instances can be killed freely",
        distractors: [
          "It runs in containers rather than on virtual machines",
          "It scales automatically in response to load",
          "It is stateless between requests but keeps a local cache",
        ],
      },
      {
        question:
          "Which of these blurs state and compute, and costs you disposability?",
        correct: "Keeping uploaded files on the instance's local disk",
        distractors: [
          "Reading configuration from environment variables at startup",
          "Caching database results in a shared Redis",
          "Writing structured logs to stdout",
        ],
      },
    ],
  },
  {
    id: "slo-definition",
    prompt:
      "How do you actually define and measure an SLO, and what makes one useless?",
    answer:
      "Pick an SLI that reflects user experience — the proportion of requests served successfully under a latency threshold — measured as close to the user as practical. Set a target over a rolling window: 99.9% of checkout requests under 500ms over 28 days. The gap between the target and 100% is the error budget, and exhausting it changes what the team works on. An SLO is useless when it measures the wrong thing (server-side CPU, uptime of a host rather than success of a request), when the target is picked as a round number rather than from what users need, or when nothing changes when it is missed.",
    emFraming:
      "The discipline is choosing a number below 100 and meaning it. A team that has never spent its error budget is either over-investing in reliability or not measuring the thing that actually breaks.",
    topicIds: [
      "reliability.slo-sli-error-budget",
      "observability.alerting-on-symptoms",
      "fundamentals.percentiles",
    ],
    tier: 1,
    speed: [
      {
        question: "Which makes an SLO useless?",
        correct: "Nothing changing when it is missed",
        distractors: [
          "Setting the target below 100%",
          "Measuring over a rolling window rather than a calendar month",
          "Choosing a latency threshold rather than an availability one",
        ],
      },
      {
        question: "What is an SLI, as distinct from an SLO?",
        correct:
          "The measurement itself — the proportion of requests served successfully under a threshold",
        distractors: [
          "The target you commit to, over a rolling window",
          "The contractual penalty owed when the target is missed",
          "The budget of allowed failure implied by the target",
        ],
      },
    ],
  },
  {
    id: "cache-stampede",
    prompt:
      "What is a cache stampede, and name three mitigations with their trade-offs.",
    answer:
      "A hot key -- one cache entry that a large share of traffic wants at the same moment, like the recipe currently on the front page -- expires, and every concurrent request misses simultaneously, so instead of one database query you get thousands at once — and because the origin was sized for the cached load, it falls over, which prevents the cache being repopulated, which keeps the stampede going. Mitigations: request coalescing, where one caller fetches and the rest wait on that result (simple, needs per-key locking); probabilistic early expiry, where requests refresh slightly before the TTL with increasing likelihood (no locking, some wasted refreshes); and serving stale while refreshing in the background (best latency, requires tolerating staleness). Never expiring hot keys and invalidating explicitly also works, if you can enumerate them.",
    emFraming:
      "The counterintuitive signal: a cache hit rate that rises during an incident is bad news, because it usually means the misses are all queued on an origin that has stopped answering.",
    topicIds: [
      "caching.stampede",
      "caching.ttl-and-staleness",
      "caching.cache-aside",
    ],
    tier: 1,
    speed: [
      {
        question: "Which signal suggests a stampede is in progress?",
        correct: "Cache hit rate rising during an incident",
        distractors: [
          "Cache hit rate falling steadily over several hours",
          "Memory usage on the cache climbing toward its limit",
          "Eviction rate increasing while request volume is flat",
        ],
      },
      {
        question: "Which stampede mitigation needs no per-key locking?",
        correct:
          "Probabilistic early expiry — refresh slightly before the TTL, with rising likelihood",
        distractors: [
          "Request coalescing, where one caller fetches and the rest wait",
          "Never expiring hot keys and invalidating them explicitly",
          "Serving stale content while refreshing in the background",
        ],
      },
    ],
  },
  {
    id: "rate-limiting-mechanics",
    prompt:
      "How does rate limiting actually work, and what are the main algorithms?",
    answer:
      "A counter per identity — API key, user, IP — checked before the request is processed, rejecting with 429 when over the limit. Fixed window is simplest and allows a double burst across a boundary. Sliding window fixes that at the cost of more state. Token bucket refills at a steady rate and permits bursts up to the bucket size, which matches how people actually use APIs and is the common default. Leaky bucket smooths output to a constant rate. Distributed enforcement needs shared state, usually Redis, which puts a dependency in front of every request.",
    emFraming:
      "Two things to insist on: limit per identity rather than globally, or one heavy customer degrades everyone; and return the limit, remaining and reset values in headers, because a rate limiter that clients cannot see turns into support tickets and blind retries.",
    topicIds: [
      "security.rate-limiting",
      "messaging.backpressure",
      "security.ddos",
    ],
    tier: 1,
    speed: [
      {
        question:
          "Which algorithm naturally allows bursts up to a configured size?",
        correct: "Token bucket",
        distractors: ["Fixed window", "Sliding window log", "Leaky bucket"],
      },
    ],
  },
]
