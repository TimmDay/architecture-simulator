import type { Card } from "../types"

export const observabilityCards: Card[] = [
  {
    id: "alert-on-symptoms",
    prompt:
      "Why should alerts fire on symptoms rather than causes, and what does that mean concretely?",
    answer:
      "Symptoms are what users experience -- error rate, latency against your SLO, failed checkouts. Causes are internal states: CPU, memory, disk, queue depth, a host being down. Alerting on causes produces pages for things nobody noticed (a node died and redundancy absorbed it) and misses things everybody noticed (every request succeeded, slowly). Concretely: page on 'p99 checkout latency exceeded 2s for 5 minutes', not on 'CPU above 80%'. Causes belong on dashboards you consult during an incident, not on the pager.",
    emFraming:
      "This is the single highest-leverage change to an on-call rotation that is burning people out. Count what fraction of last month's pages required any human action; if it is under half, you are alerting on causes.",
    topicIds: [
      "observability.alerting-on-symptoms",
      "reliability.slo-sli-error-budget",
    ],
    tier: 1,
    speed: [
      {
        question: "Which is a symptom-based alert?",
        correct: "p99 checkout latency above 2s for five minutes",
        distractors: [
          "CPU above 80% on any application instance",
          "A host failing its health check",
          "Queue depth exceeding ten thousand messages",
        ],
      },
    ],
  },
  {
    id: "silent-failure",
    prompt:
      "A system degrades badly but returns no errors. Why is this worse than an outage, and what catches it?",
    answer:
      "Nothing goes red, so nothing pages, so nobody investigates -- and users experience it for hours or weeks before someone complains. An outage is loud and gets fixed in minutes. Latency percentiles measured against an SLO catch it; error-rate and host-health alerting does not. Common sources: a slow dependency, a cache that has quietly stopped hitting, a thread pool at capacity, a queue consumer falling behind.",
    emFraming:
      "Ask your team to name the last silent degradation they found and how they found it. If the answer is 'a customer told us', that is the gap, and it is a monitoring gap rather than a reliability one.",
    topicIds: [
      "observability.alerting-on-symptoms",
      "observability.red-and-use",
      "fundamentals.percentiles",
    ],
    tier: 1,
    speed: [
      {
        question:
          "What catches a silent degradation that error-rate alerting misses?",
        correct: "Latency percentiles measured against an SLO",
        distractors: [
          "Host health checks and instance restarts",
          "Log volume anomaly detection",
          "Synthetic checks of the login endpoint",
        ],
      },
    ],
  },
  {
    id: "red-and-use",
    prompt: "What are the RED and USE methods, and when do you reach for each?",
    answer:
      "RED covers request-driven services: Rate (requests/sec), Errors (failures/sec), Duration (latency distribution) -- the user's view, so it is what you alert on. USE covers resources: Utilization, Saturation, Errors, applied per resource such as CPU, disk, or a connection pool -- the operator's view, so it is what you consult to find out why. RED tells you something is wrong; USE tells you where.",
    emFraming:
      "Having both, and knowing which is which, is what stops an incident from becoming forty minutes of people guessing at dashboards. RED is the pager, USE is the investigation.",
    topicIds: [
      "observability.red-and-use",
      "observability.metrics-logs-traces",
    ],
    tier: 1,
    speed: [
      {
        question: "RED and USE: which is which?",
        correct:
          "RED is the user's view and belongs on the pager; USE is the resource view you consult to find out why",
        distractors: [
          "RED covers resources, USE covers requests",
          "Both measure requests, but USE adds saturation",
          "RED is for synchronous services, USE for asynchronous ones",
        ],
      },
    ],
  },
  {
    id: "metrics-logs-traces",
    prompt:
      "Metrics, logs and traces: what is each actually good at, and what is the cost of each?",
    answer:
      "Metrics are cheap numeric aggregates over time -- ideal for alerting and trends, useless for explaining one specific request. Logs are detailed per-event records, good for forensic detail, and expensive at volume. Traces follow one request across service boundaries, which is the only practical way to answer 'where did those 800ms actually go' in a distributed system, and are usually sampled because keeping all of them is prohibitive. The cost of all three scales with cardinality and volume, and observability bills routinely rival compute.",
    emFraming:
      "The budget conversation is a real one at senior level: sampling rates and retention are product decisions, not infrastructure trivia. Decide deliberately what you can afford to be unable to investigate.",
    topicIds: [
      "observability.metrics-logs-traces",
      "observability.cardinality",
      "cost.unit-economics",
    ],
    tier: 2,
    speed: [
      {
        question:
          "Which is the only practical way to find where 800ms went across five services?",
        correct: "A distributed trace",
        distractors: [
          "Metrics, aggregated per service and compared",
          "Logs, correlated by request id",
          "Profiling each service under synthetic load",
        ],
      },
    ],
  },
  {
    id: "cardinality",
    prompt:
      "What is cardinality in a metrics system, and why does it cause bills and outages?",
    answer:
      "The number of distinct label combinations on a metric -- every unique pairing of labels creates its own time series to store and index. Adding a high-variability label such as user ID, request ID or full URL path multiplies series count by the number of distinct values, so one well-meaning label can turn a thousand series into ten million. The result is a large bill, then a slow query layer, then the monitoring system itself falling over -- typically during the incident you needed it for.",
    emFraming:
      "The rule of thumb worth enforcing in review: labels are for things with a small, bounded set of values. Anything unbounded belongs in a log or a trace, never on a metric.",
    topicIds: [
      "observability.cardinality",
      "observability.metrics-logs-traces",
    ],
    tier: 2,
    speed: [
      {
        question: "Which label will blow up a metrics system?",
        correct: "Request id",
        distractors: ["HTTP status code", "Region", "Service name"],
      },
    ],
  },
]
