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
} as const

export type DomainId = keyof typeof DOMAINS

type TopicDef = { domain: DomainId; label: string }

export const TOPICS = {
  // fundamentals
  "fundamentals.latency-numbers": {
    domain: "fundamentals",
    label: "Latency numbers",
  },
  "fundamentals.throughput-vs-latency": {
    domain: "fundamentals",
    label: "Throughput vs latency",
  },
  "fundamentals.percentiles": {
    domain: "fundamentals",
    label: "Percentiles and tail latency",
  },
  "fundamentals.littles-law": { domain: "fundamentals", label: "Little's Law" },
  "fundamentals.universal-scalability": {
    domain: "fundamentals",
    label: "Amdahl and the USL",
  },

  // scaling
  "scaling.vertical-vs-horizontal": {
    domain: "scaling",
    label: "Vertical vs horizontal scaling",
  },
  "scaling.statelessness": { domain: "scaling", label: "Statelessness" },
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
  },
  "load-balancing.health-checks": {
    domain: "load-balancing",
    label: "Health checks",
  },
  "load-balancing.anycast-and-dns": {
    domain: "load-balancing",
    label: "Anycast and DNS",
  },

  // caching
  "caching.cache-aside": { domain: "caching", label: "Cache-aside" },
  "caching.write-through": {
    domain: "caching",
    label: "Write-through and write-behind",
  },
  "caching.invalidation": { domain: "caching", label: "Invalidation" },
  "caching.ttl-and-staleness": {
    domain: "caching",
    label: "TTL and staleness",
  },
  "caching.stampede": { domain: "caching", label: "Cache stampede" },
  "caching.cdn": { domain: "caching", label: "CDNs" },
  "caching.edge-caching": { domain: "caching", label: "Edge caching" },

  // data-stores
  "data-stores.relational-vs-document": {
    domain: "data-stores",
    label: "Relational vs document",
  },
  "data-stores.kv-and-wide-column": {
    domain: "data-stores",
    label: "Key-value and wide-column",
  },
  "data-stores.graph": { domain: "data-stores", label: "Graph databases" },
  "data-stores.timeseries": {
    domain: "data-stores",
    label: "Time-series stores",
  },
  "data-stores.indexing": { domain: "data-stores", label: "Indexing" },
  "data-stores.denormalization": {
    domain: "data-stores",
    label: "Denormalization",
  },

  // consistency
  "consistency.cap": { domain: "consistency", label: "CAP theorem" },
  "consistency.pacelc": { domain: "consistency", label: "PACELC" },
  "consistency.linearizability": {
    domain: "consistency",
    label: "Linearizability",
  },
  "consistency.causal": { domain: "consistency", label: "Causal consistency" },
  "consistency.eventual": {
    domain: "consistency",
    label: "Eventual consistency",
  },
  "consistency.quorum-rw": {
    domain: "consistency",
    label: "Quorum reads and writes",
  },
  "consistency.read-your-writes": {
    domain: "consistency",
    label: "Read-your-writes",
  },
  "consistency.monotonic-reads": {
    domain: "consistency",
    label: "Monotonic reads",
  },

  // replication
  "replication.leader-follower": {
    domain: "replication",
    label: "Leader-follower",
  },
  "replication.multi-leader": { domain: "replication", label: "Multi-leader" },
  "replication.leaderless": { domain: "replication", label: "Leaderless" },
  "replication.lag": { domain: "replication", label: "Replication lag" },
  "replication.failover": { domain: "replication", label: "Failover" },
  "replication.split-brain": { domain: "replication", label: "Split-brain" },
  "replication.rpo-rto": { domain: "replication", label: "RPO and RTO" },

  // partitioning
  "partitioning.strategies": {
    domain: "partitioning",
    label: "Partitioning strategies",
  },
  "partitioning.consistent-hashing": {
    domain: "partitioning",
    label: "Consistent hashing",
  },
  "partitioning.hot-keys": { domain: "partitioning", label: "Hot keys" },
  "partitioning.rebalancing": { domain: "partitioning", label: "Rebalancing" },
  "partitioning.cross-shard-queries": {
    domain: "partitioning",
    label: "Cross-shard queries",
  },

  // transactions
  "transactions.acid": { domain: "transactions", label: "ACID" },
  "transactions.isolation-levels": {
    domain: "transactions",
    label: "Isolation levels",
  },
  "transactions.two-phase-commit": {
    domain: "transactions",
    label: "Two-phase commit",
  },
  "transactions.sagas": { domain: "transactions", label: "Sagas" },
  "transactions.outbox": {
    domain: "transactions",
    label: "Transactional outbox",
  },
  "transactions.idempotency": { domain: "transactions", label: "Idempotency" },

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
  "messaging.queue-vs-log": { domain: "messaging", label: "Queue vs log" },
  "messaging.delivery-semantics": {
    domain: "messaging",
    label: "Delivery semantics",
  },
  "messaging.ordering": { domain: "messaging", label: "Ordering" },
  "messaging.backpressure": { domain: "messaging", label: "Backpressure" },
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
  "styles.monolith": { domain: "styles", label: "Monolith" },
  "styles.modular-monolith": { domain: "styles", label: "Modular monolith" },
  "styles.microservices": { domain: "styles", label: "Microservices" },
  "styles.event-driven": { domain: "styles", label: "Event-driven" },
  "styles.cqrs-es": { domain: "styles", label: "CQRS and event sourcing" },
  "styles.serverless": { domain: "styles", label: "Serverless" },
  "styles.cell-based": { domain: "styles", label: "Cell-based architecture" },

  // api
  "api.rest-grpc-graphql": { domain: "api", label: "REST, gRPC, GraphQL" },
  "api.versioning": { domain: "api", label: "Versioning" },
  "api.pagination": { domain: "api", label: "Pagination" },
  "api.gateway-and-bff": { domain: "api", label: "Gateways and BFF" },
  "api.n-plus-one": { domain: "api", label: "N+1 and chatty services" },

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
  },

  // reliability
  "reliability.slo-sli-error-budget": {
    domain: "reliability",
    label: "SLOs, SLIs, error budgets",
  },
  "reliability.redundancy": { domain: "reliability", label: "Redundancy" },
  "reliability.failure-domains": {
    domain: "reliability",
    label: "Failure domains",
  },
  "reliability.circuit-breaker": {
    domain: "reliability",
    label: "Circuit breakers",
  },
  "reliability.retries-and-jitter": {
    domain: "reliability",
    label: "Retries and jitter",
  },
  "reliability.bulkheads": { domain: "reliability", label: "Bulkheads" },
  "reliability.graceful-degradation": {
    domain: "reliability",
    label: "Graceful degradation",
  },
  "reliability.chaos": { domain: "reliability", label: "Chaos engineering" },

  "partitioning.shard-key": {
    domain: "partitioning",
    label: "Choosing a shard key",
  },
  "partitioning.global-invariants": {
    domain: "partitioning",
    label: "Invariants across partitions",
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
  },
  "observability.alerting-on-symptoms": {
    domain: "observability",
    label: "Alerting on symptoms",
  },

  // security
  "security.authn-vs-authz": {
    domain: "security",
    label: "Authentication vs authorization",
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
  "security.rate-limiting": { domain: "security", label: "Rate limiting" },
  "security.ddos": { domain: "security", label: "DDoS" },
  "security.zero-trust": { domain: "security", label: "Zero trust" },

  // delivery
  "delivery.blue-green": { domain: "delivery", label: "Blue-green deploys" },
  "delivery.canary": { domain: "delivery", label: "Canary releases" },
  "delivery.feature-flags": { domain: "delivery", label: "Feature flags" },
  "delivery.expand-contract-migrations": {
    domain: "delivery",
    label: "Expand-contract migrations",
  },
  "delivery.iac": { domain: "delivery", label: "Infrastructure as code" },

  "delivery.testing-pyramid": {
    domain: "delivery",
    label: "Unit, integration and end-to-end tests",
  },
  "delivery.rollback": { domain: "delivery", label: "Rollback" },

  // cost
  "cost.unit-economics": { domain: "cost", label: "Unit economics" },
  "cost.egress": { domain: "cost", label: "Egress costs" },
  "cost.right-sizing": { domain: "cost", label: "Right-sizing" },
  "cost.serverless-vs-reserved": {
    domain: "cost",
    label: "Serverless vs reserved capacity",
  },

  // org
  "org.conways-law": { domain: "org", label: "Conway's Law" },
  "org.team-topologies": { domain: "org", label: "Team topologies" },
  "org.ownership-boundaries": { domain: "org", label: "Ownership boundaries" },
  "org.build-vs-buy": { domain: "org", label: "Build vs buy" },
} as const satisfies Record<string, TopicDef>

export type TopicId = keyof typeof TOPICS

export const ALL_TOPIC_IDS = Object.keys(TOPICS) as TopicId[]

export function topicLabel(id: TopicId): string {
  return TOPICS[id].label
}

export function topicDomain(id: TopicId): DomainId {
  return TOPICS[id].domain
}

export function topicsInDomain(domain: DomainId): TopicId[] {
  return ALL_TOPIC_IDS.filter((id) => TOPICS[id].domain === domain)
}
