/**
 * The shared topic taxonomy -- the spine that joins Drill and Build.
 *
 * `TopicId` is derived from this object, so it is a union of ~90 literal strings
 * rather than `string`. That matters: cards and simulator rules are written
 * independently, and the feedback loop (a failed rule enqueues that topic's
 * cards) only fires when the IDs match exactly. As a bare `string` a typo would
 * silently never match and the loop would just quietly not work. As a union, it
 * is a compile error.
 */

export const DOMAINS = {
  fundamentals: "Fundamentals",
  scaling: "Scaling",
  "load-balancing": "Load balancing",
  caching: "Caching",
  "data-stores": "Data stores",
  consistency: "Consistency",
  replication: "Replication",
  partitioning: "Partitioning",
  transactions: "Transactions",
  messaging: "Messaging",
  styles: "Architecture styles",
  api: "APIs",
  frontend: "Frontend & delivery",
  reliability: "Reliability",
  observability: "Observability",
  security: "Security",
  delivery: "Delivery",
  cost: "Cost",
  org: "Organisation",
  realtime: "Real-time delivery",
  consensus: "Consensus & coordination",
  designs: "Canonical designs",
  interview: "Interview technique",
} as const

export type DomainId = keyof typeof DOMAINS

/**
 * How much this topic matters in a system design interview.
 *
 *   3 -- asked in most interviews. If you fumble it, it is noticed.
 *   2 -- asked whenever the design touches it.
 *   1 -- depth. Good to know, rarely decisive.
 *
 * Three levels rather than ten on purpose. Nobody -- not me, not a reviewer --
 * can honestly distinguish a 7 from an 8 across 160 topics, and a scale finer
 * than the judgement behind it produces noise that looks like signal.
 *
 * Weighting lives on the TOPIC rather than the card so that it stays consistent
 * as cards are added, and so a new card inherits sensible weighting for free.
 */
export type Weight = 1 | 2 | 3

type TopicDef = { domain: DomainId; label: string; weight?: Weight }

export const TOPICS = {
  // fundamentals
  "fundamentals.latency-numbers": {
    domain: "fundamentals",
    label: "Latency numbers",
    weight: 3,
  },
  "fundamentals.throughput-vs-latency": {
    domain: "fundamentals",
    label: "Throughput vs latency",
    weight: 3,
  },
  "fundamentals.percentiles": {
    domain: "fundamentals",
    label: "Percentiles and tail latency",
    weight: 3,
  },
  "fundamentals.littles-law": { domain: "fundamentals", label: "Little's Law" },
  "fundamentals.universal-scalability": {
    domain: "fundamentals",
    label: "Amdahl and the USL",
    weight: 1,
  },

  // scaling
  "scaling.vertical-vs-horizontal": {
    domain: "scaling",
    label: "Vertical vs horizontal scaling",
    weight: 3,
  },
  "scaling.statelessness": {
    domain: "scaling",
    label: "Statelessness",
    weight: 3,
  },
  "scaling.session-affinity": { domain: "scaling", label: "Session affinity" },
  "scaling.autoscaling": { domain: "scaling", label: "Autoscaling" },
  "scaling.connection-pooling": {
    domain: "scaling",
    label: "Connection pooling",
  },

  // load-balancing
  "load-balancing.l4-vs-l7": { domain: "load-balancing", label: "L4 vs L7" },
  "load-balancing.algorithms": {
    domain: "load-balancing",
    label: "Balancing algorithms",
    weight: 3,
  },
  "load-balancing.health-checks": {
    domain: "load-balancing",
    label: "Health checks",
  },
  "load-balancing.anycast-and-dns": {
    domain: "load-balancing",
    label: "Anycast and DNS",
    weight: 1,
  },

  // caching
  "caching.cache-aside": { domain: "caching", label: "Cache-aside", weight: 3 },
  "caching.write-through": {
    domain: "caching",
    label: "Write-through and write-behind",
  },
  "caching.invalidation": {
    domain: "caching",
    label: "Invalidation",
    weight: 3,
  },
  "caching.ttl-and-staleness": {
    domain: "caching",
    label: "TTL and staleness",
  },
  "caching.stampede": { domain: "caching", label: "Cache stampede", weight: 3 },
  "caching.cdn": { domain: "caching", label: "CDNs", weight: 3 },
  "caching.edge-caching": { domain: "caching", label: "Edge caching" },

  // data-stores
  "data-stores.relational-vs-document": {
    domain: "data-stores",
    label: "Relational vs document",
    weight: 3,
  },
  "data-stores.kv-and-wide-column": {
    domain: "data-stores",
    label: "Key-value and wide-column",
  },
  "data-stores.graph": {
    domain: "data-stores",
    label: "Graph databases",
    weight: 1,
  },
  "data-stores.timeseries": {
    domain: "data-stores",
    label: "Time-series stores",
    weight: 1,
  },
  "data-stores.indexing": {
    domain: "data-stores",
    label: "Indexing",
    weight: 3,
  },
  "data-stores.denormalization": {
    domain: "data-stores",
    label: "Denormalization",
  },

  // consistency
  "consistency.cap": { domain: "consistency", label: "CAP theorem", weight: 3 },
  "consistency.pacelc": { domain: "consistency", label: "PACELC", weight: 1 },
  "consistency.linearizability": {
    domain: "consistency",
    label: "Linearizability",
  },
  "consistency.causal": { domain: "consistency", label: "Causal consistency" },
  "consistency.eventual": {
    domain: "consistency",
    label: "Eventual consistency",
    weight: 3,
  },
  "consistency.quorum-rw": {
    domain: "consistency",
    label: "Quorum reads and writes",
  },
  "consistency.read-your-writes": {
    domain: "consistency",
    label: "Read-your-writes",
    weight: 3,
  },
  "consistency.monotonic-reads": {
    domain: "consistency",
    label: "Monotonic reads",
    weight: 1,
  },

  // replication
  "replication.leader-follower": {
    domain: "replication",
    label: "Leader-follower",
    weight: 3,
  },
  "replication.multi-leader": { domain: "replication", label: "Multi-leader" },
  "replication.leaderless": { domain: "replication", label: "Leaderless" },
  "replication.lag": {
    domain: "replication",
    label: "Replication lag",
    weight: 3,
  },
  "replication.failover": { domain: "replication", label: "Failover" },
  "replication.split-brain": { domain: "replication", label: "Split-brain" },
  "replication.rpo-rto": { domain: "replication", label: "RPO and RTO" },

  // partitioning
  "partitioning.strategies": {
    domain: "partitioning",
    label: "Partitioning strategies",
    weight: 3,
  },
  "partitioning.consistent-hashing": {
    domain: "partitioning",
    label: "Consistent hashing",
  },
  "partitioning.hot-keys": {
    domain: "partitioning",
    label: "Hot keys",
    weight: 3,
  },
  "partitioning.rebalancing": { domain: "partitioning", label: "Rebalancing" },
  "partitioning.cross-shard-queries": {
    domain: "partitioning",
    label: "Cross-shard queries",
  },

  // transactions
  "transactions.acid": { domain: "transactions", label: "ACID", weight: 3 },
  "transactions.isolation-levels": {
    domain: "transactions",
    label: "Isolation levels",
    weight: 3,
  },
  "transactions.two-phase-commit": {
    domain: "transactions",
    label: "Two-phase commit",
    weight: 1,
  },
  "transactions.sagas": { domain: "transactions", label: "Sagas" },
  "transactions.outbox": {
    domain: "transactions",
    label: "Transactional outbox",
  },
  "transactions.idempotency": {
    domain: "transactions",
    label: "Idempotency",
    weight: 3,
  },

  "transactions.atomicity": {
    domain: "transactions",
    label: "Atomicity",
  },
  "transactions.lost-update": {
    domain: "transactions",
    label: "Lost updates",
  },
  "transactions.mvcc": { domain: "transactions", label: "MVCC" },
  "transactions.optimistic-locking": {
    domain: "transactions",
    label: "Optimistic locking",
  },
  "transactions.pessimistic-locking": {
    domain: "transactions",
    label: "Pessimistic locking",
  },
  "transactions.deadlocks": {
    domain: "transactions",
    label: "Lock contention and deadlocks",
  },
  "transactions.upsert": { domain: "transactions", label: "Upserts" },
  "transactions.compensating-actions": {
    domain: "transactions",
    label: "Compensating actions",
  },

  // messaging
  "messaging.queue-vs-log": {
    domain: "messaging",
    label: "Queue vs log",
    weight: 3,
  },
  "messaging.delivery-semantics": {
    domain: "messaging",
    label: "Delivery semantics",
    weight: 3,
  },
  "messaging.ordering": { domain: "messaging", label: "Ordering" },
  "messaging.backpressure": {
    domain: "messaging",
    label: "Backpressure",
    weight: 3,
  },
  "messaging.dlq": { domain: "messaging", label: "Dead-letter queues" },
  "messaging.consumer-lag": { domain: "messaging", label: "Consumer lag" },
  "messaging.fanout": { domain: "messaging", label: "Fanout" },

  "messaging.kafka-partitions": {
    domain: "messaging",
    label: "Topics and partitions",
  },
  "messaging.consumer-groups": {
    domain: "messaging",
    label: "Consumer groups",
  },
  "messaging.offsets": { domain: "messaging", label: "Offsets and commits" },

  // styles
  "styles.monolith": { domain: "styles", label: "Monolith", weight: 3 },
  "styles.modular-monolith": { domain: "styles", label: "Modular monolith" },
  "styles.microservices": {
    domain: "styles",
    label: "Microservices",
    weight: 3,
  },
  "styles.event-driven": { domain: "styles", label: "Event-driven", weight: 3 },
  "styles.cqrs-es": { domain: "styles", label: "CQRS and event sourcing" },
  "styles.serverless": { domain: "styles", label: "Serverless" },
  "styles.cell-based": { domain: "styles", label: "Cell-based architecture" },

  // api
  "api.rest-grpc-graphql": {
    domain: "api",
    label: "REST, gRPC, GraphQL",
    weight: 3,
  },
  "api.versioning": { domain: "api", label: "Versioning" },
  "api.pagination": { domain: "api", label: "Pagination" },
  "api.gateway-and-bff": { domain: "api", label: "Gateways and BFF" },
  "api.n-plus-one": {
    domain: "api",
    label: "N+1 and chatty services",
    weight: 3,
  },
  "api.rest-design": { domain: "api", label: "REST API design", weight: 3 },
  "api.status-codes": { domain: "api", label: "HTTP methods and status codes" },

  // frontend
  "frontend.rendering-strategy": {
    domain: "frontend",
    label: "Static, SSR and CSR",
  },
  "frontend.client-validation": {
    domain: "frontend",
    label: "Client-side validation",
  },
  "frontend.client-resilience": {
    domain: "frontend",
    label: "Client retries and offline",
  },
  "frontend.bundle-and-caching": {
    domain: "frontend",
    label: "Bundles and cache headers",
    weight: 1,
  },

  // reliability
  "reliability.slo-sli-error-budget": {
    domain: "reliability",
    label: "SLOs, SLIs, error budgets",
    weight: 3,
  },
  "reliability.redundancy": {
    domain: "reliability",
    label: "Redundancy",
    weight: 3,
  },
  "reliability.failure-domains": {
    domain: "reliability",
    label: "Failure domains",
    weight: 3,
  },
  "reliability.circuit-breaker": {
    domain: "reliability",
    label: "Circuit breakers",
    weight: 3,
  },
  "reliability.retries-and-jitter": {
    domain: "reliability",
    label: "Retries and jitter",
    weight: 3,
  },
  "reliability.bulkheads": { domain: "reliability", label: "Bulkheads" },
  "reliability.graceful-degradation": {
    domain: "reliability",
    label: "Graceful degradation",
    weight: 3,
  },
  "reliability.chaos": { domain: "reliability", label: "Chaos engineering" },

  "partitioning.shard-key": {
    domain: "partitioning",
    label: "Choosing a shard key",
    weight: 3,
  },
  "partitioning.global-invariants": {
    domain: "partitioning",
    label: "Invariants across partitions",
    weight: 1,
  },
  "reliability.state-vs-compute": {
    domain: "reliability",
    label: "Authoritative state vs compute",
  },

  // observability
  "observability.metrics-logs-traces": {
    domain: "observability",
    label: "Metrics, logs, traces",
  },
  "observability.red-and-use": {
    domain: "observability",
    label: "RED and USE methods",
  },
  "observability.cardinality": {
    domain: "observability",
    label: "Cardinality",
    weight: 1,
  },
  "observability.alerting-on-symptoms": {
    domain: "observability",
    label: "Alerting on symptoms",
    weight: 3,
  },

  // security
  "security.authn-vs-authz": {
    domain: "security",
    label: "Authentication vs authorization",
    weight: 3,
  },
  "security.oauth-oidc-jwt": { domain: "security", label: "OAuth, OIDC, JWT" },
  "security.secrets": { domain: "security", label: "Secrets management" },
  "security.encryption-in-transit": {
    domain: "security",
    label: "Encryption in transit",
  },
  "security.encryption-at-rest": {
    domain: "security",
    label: "Encryption at rest",
  },
  "security.least-privilege": { domain: "security", label: "Least privilege" },
  "security.pii-and-residency": {
    domain: "security",
    label: "PII and data residency",
  },
  "security.rate-limiting": {
    domain: "security",
    label: "Rate limiting",
    weight: 3,
  },
  "security.ddos": { domain: "security", label: "DDoS" },
  "security.zero-trust": { domain: "security", label: "Zero trust", weight: 1 },

  // delivery
  "delivery.blue-green": { domain: "delivery", label: "Blue-green deploys" },
  "delivery.canary": { domain: "delivery", label: "Canary releases" },
  "delivery.feature-flags": { domain: "delivery", label: "Feature flags" },
  "delivery.expand-contract-migrations": {
    domain: "delivery",
    label: "Expand-contract migrations",
    weight: 1,
  },
  "delivery.iac": {
    domain: "delivery",
    label: "Infrastructure as code",
    weight: 1,
  },

  "delivery.testing-pyramid": {
    domain: "delivery",
    label: "Unit, integration and end-to-end tests",
  },
  "delivery.rollback": { domain: "delivery", label: "Rollback" },

  // cost
  "cost.unit-economics": { domain: "cost", label: "Unit economics" },
  "cost.egress": { domain: "cost", label: "Egress costs", weight: 1 },
  "cost.right-sizing": { domain: "cost", label: "Right-sizing" },
  "cost.serverless-vs-reserved": {
    domain: "cost",
    label: "Serverless vs reserved capacity",
    weight: 1,
  },

  // org
  "org.conways-law": { domain: "org", label: "Conway's Law" },
  "org.team-topologies": { domain: "org", label: "Team topologies", weight: 1 },
  "org.ownership-boundaries": { domain: "org", label: "Ownership boundaries" },
  "org.build-vs-buy": { domain: "org", label: "Build vs buy", weight: 1 },
  // fundamentals (added for estimation and tail latency)
  "fundamentals.estimation": {
    domain: "fundamentals",
    label: "Back-of-envelope estimation",
    weight: 3,
  },
  "fundamentals.tail-latency": {
    domain: "fundamentals",
    label: "Tail latency amplification",
  },

  // data stores -- engine internals and specialised structures
  "data-stores.lsm-vs-btree": {
    domain: "data-stores",
    label: "LSM trees vs B-trees",
  },
  "data-stores.write-ahead-log": {
    domain: "data-stores",
    label: "Write-ahead log",
  },
  "data-stores.bloom-filter": { domain: "data-stores", label: "Bloom filters" },
  "data-stores.inverted-index": {
    domain: "data-stores",
    label: "Inverted index",
  },
  "data-stores.geospatial-index": {
    domain: "data-stores",
    label: "Geospatial indexing",
  },
  "data-stores.columnar": {
    domain: "data-stores",
    label: "Columnar storage",
    weight: 1,
  },
  "data-stores.unique-ids": {
    domain: "data-stores",
    label: "Unique IDs at scale",
  },

  // reliability -- shedding and hedging
  "reliability.load-shedding": {
    domain: "reliability",
    label: "Load shedding",
  },
  "reliability.hedged-requests": {
    domain: "reliability",
    label: "Hedged requests",
  },

  // realtime
  "realtime.transport-choice": {
    domain: "realtime",
    label: "WebSockets, SSE and polling",
    weight: 3,
  },
  "realtime.push-vs-pull": { domain: "realtime", label: "Push vs pull" },
  "realtime.presence-and-fanout": {
    domain: "realtime",
    label: "Presence and fanout",
  },
  "realtime.connection-scaling": {
    domain: "realtime",
    label: "Scaling long-lived connections",
  },

  // consensus
  "consensus.raft": { domain: "consensus", label: "Raft and consensus" },
  "consensus.leader-election": {
    domain: "consensus",
    label: "Leader election",
    weight: 3,
  },
  "consensus.fencing": { domain: "consensus", label: "Fencing tokens" },
  "consensus.distributed-locks": {
    domain: "consensus",
    label: "Distributed locks",
  },
  "consensus.coordination-services": {
    domain: "consensus",
    label: "ZooKeeper and etcd",
  },
  "consensus.crdts": {
    domain: "consensus",
    label: "CRDTs and vector clocks",
    weight: 1,
  },

  // canonical designs
  "designs.url-shortener": { domain: "designs", label: "URL shortener" },
  "designs.rate-limiter": { domain: "designs", label: "Rate limiter" },
  "designs.news-feed": { domain: "designs", label: "News feed" },
  "designs.chat": { domain: "designs", label: "Chat system" },
  "designs.notifications": { domain: "designs", label: "Notification fanout" },
  "designs.web-crawler": { domain: "designs", label: "Web crawler" },
  "designs.autocomplete": { domain: "designs", label: "Search autocomplete" },
  "designs.video-streaming": { domain: "designs", label: "Video streaming" },
  "designs.ride-hailing": { domain: "designs", label: "Ride hailing" },
  "designs.payments": { domain: "designs", label: "Payment system" },
  "designs.metrics-system": {
    domain: "designs",
    label: "Metrics and monitoring",
  },
  "designs.object-storage": { domain: "designs", label: "Object storage" },

  // interview technique
  "interview.requirements": {
    domain: "interview",
    label: "Scoping the requirements",
    weight: 3,
  },
  "interview.method": {
    domain: "interview",
    label: "Structuring the hour",
    weight: 3,
  },
  "interview.tradeoffs": { domain: "interview", label: "Naming the trade-off" },
  "interview.deep-dive": {
    domain: "interview",
    label: "Surviving the deep dive",
  },
} as const satisfies Record<string, TopicDef>

export type TopicId = keyof typeof TOPICS

export const ALL_TOPIC_IDS = Object.keys(TOPICS) as TopicId[]

export function topicLabel(id: TopicId): string {
  return TOPICS[id].label
}

export function topicDomain(id: TopicId): DomainId {
  return TOPICS[id].domain
}

/** Defaults to 2: asked when the design touches it. */
export function topicWeight(id: TopicId): Weight {
  return (TOPICS[id] as TopicDef).weight ?? 2
}

export function topicsInDomain(domain: DomainId): TopicId[] {
  return ALL_TOPIC_IDS.filter((id) => TOPICS[id].domain === domain)
}
