import type { Card } from "../types"

/**
 * Vocabulary.
 *
 * One-line definitions of the terms themselves, so the language stops costing
 * you effort. You should not be working out what "quorum" means while also
 * reasoning about whether you need one.
 *
 * Speed-only: typing out "all reads see the latest write" and self-grading it
 * is ceremony, and it would clog the review queue the harder cards depend on.
 * The distractors are still real -- each one is a neighbouring term somebody
 * genuinely confuses this with, so getting it right means you can separate them.
 */
export const vocabularyCards: Card[] = [
  {
    id: "vocab-consistency",
    deck: "vocabulary",
    prompt: "Consistency",
    answer: "Every read sees the most recent write",
    topicIds: ["consistency.linearizability"],
    tier: 1,
    speed: [
      {
        question: "Consistency",
        correct: "Every read sees the most recent write",
        distractors: [
          "Every request gets a response, even during a failure",
          "The system keeps working when the network splits",
          "Data survives a crash once it has been acknowledged",
        ],
      },
    ],
  },
  {
    id: "vocab-availability",
    deck: "vocabulary",
    prompt: "Availability",
    answer: "Every request to a working node gets a non-error response",
    topicIds: ["consistency.cap"],
    tier: 1,
    speed: [
      {
        question: "Availability",
        correct: "Every request to a working node gets a non-error response",
        distractors: [
          "Every read sees the most recent write",
          "The proportion of time the system is powered on",
          "The system can be reached from any region",
        ],
      },
    ],
  },
  {
    id: "vocab-partition-tolerance",
    deck: "vocabulary",
    prompt: "Partition tolerance",
    answer: "The system keeps operating when the network splits it in two",
    topicIds: ["consistency.cap"],
    tier: 1,
    speed: [
      {
        question: "Partition tolerance",
        correct: "The system keeps operating when the network splits it in two",
        distractors: [
          "Data is divided evenly across nodes by a key",
          "The system tolerates the loss of any single machine",
          "Reads and writes are routed to separate replicas",
        ],
      },
    ],
  },
  {
    id: "vocab-durability",
    deck: "vocabulary",
    prompt: "Durability",
    answer: "Once a write is acknowledged, it survives crashes and restarts",
    topicIds: ["transactions.acid"],
    tier: 1,
    speed: [
      {
        question: "Durability",
        correct:
          "Once a write is acknowledged, it survives crashes and restarts",
        distractors: [
          "Once a write is acknowledged, all replicas have applied it",
          "Data is retained for a configured period before deletion",
          "The system recovers automatically without human intervention",
        ],
      },
    ],
  },
  {
    id: "vocab-atomicity",
    deck: "vocabulary",
    prompt: "Atomicity",
    answer: "All the statements in a transaction take effect, or none do",
    topicIds: ["transactions.atomicity"],
    tier: 1,
    speed: [
      {
        question: "Atomicity",
        correct: "All the statements in a transaction take effect, or none do",
        distractors: [
          "Each statement runs without interference from others",
          "Committed data survives a power failure",
          "Every transaction leaves the database satisfying its constraints",
        ],
      },
    ],
  },
  {
    id: "vocab-isolation",
    deck: "vocabulary",
    prompt: "Isolation",
    answer:
      "Concurrent transactions do not interfere with each other's intermediate state",
    topicIds: ["transactions.isolation-levels"],
    tier: 1,
    speed: [
      {
        question: "Isolation",
        correct:
          "Concurrent transactions do not interfere with each other's intermediate state",
        distractors: [
          "Each service owns its own database and no other reads it",
          "Transactions are applied one at a time, in order",
          "Failed transactions leave no trace behind",
        ],
      },
    ],
  },
  {
    id: "vocab-idempotent",
    deck: "vocabulary",
    prompt: "Idempotent",
    answer: "Doing it more than once has the same effect as doing it once",
    topicIds: ["transactions.idempotency"],
    tier: 1,
    speed: [
      {
        question: "Idempotent",
        correct: "Doing it more than once has the same effect as doing it once",
        distractors: [
          "It always produces the same output for the same input",
          "It can be safely run in parallel with itself",
          "It can be undone by running its inverse",
        ],
      },
    ],
  },
  {
    id: "vocab-latency",
    deck: "vocabulary",
    prompt: "Latency",
    answer: "How long one request takes",
    topicIds: ["fundamentals.throughput-vs-latency"],
    tier: 1,
    speed: [
      {
        question: "Latency",
        correct: "How long one request takes",
        distractors: [
          "How many requests the system handles per second",
          "The delay before a replica catches up with the leader",
          "The time between a failure and its detection",
        ],
      },
    ],
  },
  {
    id: "vocab-throughput",
    deck: "vocabulary",
    prompt: "Throughput",
    answer: "How many requests the system handles per unit of time",
    topicIds: ["fundamentals.throughput-vs-latency"],
    tier: 1,
    speed: [
      {
        question: "Throughput",
        correct: "How many requests the system handles per unit of time",
        distractors: [
          "How long any one request takes end to end",
          "The maximum data a link can carry",
          "The proportion of requests that succeed",
        ],
      },
    ],
  },
  {
    id: "vocab-p99",
    deck: "vocabulary",
    prompt: "p99 latency",
    answer:
      "The value 99% of requests come in under — one in a hundred is slower",
    topicIds: ["fundamentals.percentiles"],
    tier: 1,
    speed: [
      {
        question: "p99 latency",
        correct:
          "The value 99% of requests come in under — one in a hundred is slower",
        distractors: [
          "The average latency across all requests",
          "The slowest request observed in the window",
          "The latency exceeded 99% of the time",
        ],
      },
    ],
  },
  {
    id: "vocab-slo",
    deck: "vocabulary",
    prompt: "SLO",
    answer:
      "The reliability target you commit to internally, measured over a window",
    topicIds: ["reliability.slo-sli-error-budget"],
    tier: 1,
    speed: [
      {
        question: "SLO",
        correct:
          "The reliability target you commit to internally, measured over a window",
        distractors: [
          "The measurement itself, such as percentage of successful requests",
          "The contractual promise to a customer, with penalties attached",
          "The allowance of failure implied by the target",
        ],
      },
    ],
  },
  {
    id: "vocab-sli",
    deck: "vocabulary",
    prompt: "SLI",
    answer:
      "The measurement — for instance the proportion of requests served under 300ms",
    topicIds: ["reliability.slo-sli-error-budget"],
    tier: 1,
    speed: [
      {
        question: "SLI",
        correct:
          "The measurement — for instance the proportion of requests served under 300ms",
        distractors: [
          "The target that measurement must meet",
          "The contract with the customer and its penalties",
          "The remaining budget of allowed failure",
        ],
      },
    ],
  },
  {
    id: "vocab-error-budget",
    deck: "vocabulary",
    prompt: "Error budget",
    answer:
      "The failure a target allows — 99.9% over 30 days permits about 43 minutes",
    topicIds: ["reliability.slo-sli-error-budget"],
    tier: 1,
    speed: [
      {
        question: "Error budget",
        correct:
          "The failure a target allows — 99.9% over 30 days permits about 43 minutes",
        distractors: [
          "The money set aside to compensate customers for outages",
          "The number of incidents allowed before an escalation",
          "The proportion of requests retried automatically",
        ],
      },
    ],
  },
  {
    id: "vocab-rpo",
    deck: "vocabulary",
    prompt: "RPO",
    answer: "How much data you can afford to lose, measured in time",
    topicIds: ["replication.rpo-rto"],
    tier: 1,
    speed: [
      {
        question: "RPO",
        correct: "How much data you can afford to lose, measured in time",
        distractors: [
          "How long you can afford to be down",
          "How often backups are taken",
          "How long a restore takes to complete",
        ],
      },
    ],
  },
  {
    id: "vocab-rto",
    deck: "vocabulary",
    prompt: "RTO",
    answer: "How long you can afford to be down before recovering",
    topicIds: ["replication.rpo-rto"],
    tier: 1,
    speed: [
      {
        question: "RTO",
        correct: "How long you can afford to be down before recovering",
        distractors: [
          "How much data you can afford to lose",
          "The time until a replica catches up",
          "The interval between failover drills",
        ],
      },
    ],
  },
  {
    id: "vocab-quorum",
    deck: "vocabulary",
    prompt: "Quorum",
    answer:
      "The minimum number of nodes that must respond for an operation to count",
    topicIds: ["consistency.quorum-rw"],
    tier: 1,
    speed: [
      {
        question: "Quorum",
        correct:
          "The minimum number of nodes that must respond for an operation to count",
        distractors: [
          "The node currently accepting writes",
          "The set of nodes holding a copy of the data",
          "The majority needed to elect a new leader, and nothing else",
        ],
      },
    ],
  },
  {
    id: "vocab-replication-lag",
    deck: "vocabulary",
    prompt: "Replication lag",
    answer: "How far behind the leader a follower's copy currently is",
    topicIds: ["replication.lag"],
    tier: 1,
    speed: [
      {
        question: "Replication lag",
        correct: "How far behind the leader a follower's copy currently is",
        distractors: [
          "The time taken to copy a full snapshot to a new replica",
          "The delay before a failed leader is replaced",
          "The interval at which replicas are refreshed",
        ],
      },
    ],
  },
  {
    id: "vocab-leader",
    deck: "vocabulary",
    prompt: "Leader (primary)",
    answer: "The node that accepts writes and orders them for everyone else",
    topicIds: ["replication.leader-follower"],
    tier: 1,
    speed: [
      {
        question: "Leader (primary)",
        correct:
          "The node that accepts writes and orders them for everyone else",
        distractors: [
          "The node with the most recent copy of the data",
          "The node clients connect to first",
          "The node that coordinates a distributed transaction",
        ],
      },
    ],
  },
  {
    id: "vocab-split-brain",
    deck: "vocabulary",
    prompt: "Split-brain",
    answer:
      "Two nodes both believing they are the leader, accepting divergent writes",
    topicIds: ["replication.split-brain"],
    tier: 1,
    speed: [
      {
        question: "Split-brain",
        correct:
          "Two nodes both believing they are the leader, accepting divergent writes",
        distractors: [
          "A cluster losing quorum and refusing all writes",
          "A replica falling so far behind it must be rebuilt",
          "Traffic being served from two regions at once",
        ],
      },
    ],
  },
  {
    id: "vocab-failover",
    deck: "vocabulary",
    prompt: "Failover",
    answer: "Promoting a standby to take over when the primary fails",
    topicIds: ["replication.failover"],
    tier: 1,
    speed: [
      {
        question: "Failover",
        correct: "Promoting a standby to take over when the primary fails",
        distractors: [
          "Routing traffic away from an unhealthy instance",
          "Restoring data from a backup after corruption",
          "Switching users to a degraded but working feature",
        ],
      },
    ],
  },
  {
    id: "vocab-sharding",
    deck: "vocabulary",
    prompt: "Sharding",
    answer: "Splitting one dataset across several nodes by a key",
    topicIds: ["partitioning.strategies"],
    tier: 1,
    speed: [
      {
        question: "Sharding",
        correct: "Splitting one dataset across several nodes by a key",
        distractors: [
          "Keeping full copies of the data on several nodes",
          "Separating reads and writes onto different machines",
          "Storing old data in cheaper storage",
        ],
      },
    ],
  },
  {
    id: "vocab-shard-key",
    deck: "vocabulary",
    prompt: "Shard key",
    answer: "The field that decides which partition a row lives on",
    topicIds: ["partitioning.shard-key"],
    tier: 1,
    speed: [
      {
        question: "Shard key",
        correct: "The field that decides which partition a row lives on",
        distractors: [
          "The primary key of the table being partitioned",
          "The column a query filters on most often",
          "The hash used to distribute load across replicas",
        ],
      },
    ],
  },
  {
    id: "vocab-hot-partition",
    deck: "vocabulary",
    prompt: "Hot partition",
    answer:
      "One shard taking far more traffic than its share, usually from a popular key",
    topicIds: ["partitioning.hot-keys"],
    tier: 1,
    speed: [
      {
        question: "Hot partition",
        correct:
          "One shard taking far more traffic than its share, usually from a popular key",
        distractors: [
          "A shard that has grown larger than the others on disk",
          "A shard whose replicas have fallen behind",
          "A shard being rebalanced while still serving traffic",
        ],
      },
    ],
  },
  {
    id: "vocab-consistent-hashing",
    deck: "vocabulary",
    prompt: "Consistent hashing",
    answer:
      "Key placement where adding or removing a node moves only about 1/N of keys",
    topicIds: ["partitioning.consistent-hashing"],
    tier: 1,
    speed: [
      {
        question: "Consistent hashing",
        correct:
          "Key placement where adding or removing a node moves only about 1/N of keys",
        distractors: [
          "Hashing that always produces the same value for the same key",
          "Distributing keys so every node holds exactly the same number",
          "Hashing the key twice to reduce collisions",
        ],
      },
    ],
  },
  {
    id: "vocab-cache-hit-ratio",
    deck: "vocabulary",
    prompt: "Cache hit ratio",
    answer: "The share of reads served without going to the origin",
    topicIds: ["caching.cache-aside"],
    tier: 1,
    speed: [
      {
        question: "Cache hit ratio",
        correct: "The share of reads served without going to the origin",
        distractors: [
          "The share of cache entries still within their TTL",
          "How full the cache is relative to its memory limit",
          "The proportion of writes that invalidate an entry",
        ],
      },
    ],
  },
  {
    id: "vocab-ttl",
    deck: "vocabulary",
    prompt: "TTL",
    answer:
      "How long a cached entry stays valid before it must be fetched again",
    topicIds: ["caching.ttl-and-staleness"],
    tier: 1,
    speed: [
      {
        question: "TTL",
        correct:
          "How long a cached entry stays valid before it must be fetched again",
        distractors: [
          "How long an entry stays in memory before eviction",
          "The maximum age of data the application will accept",
          "The timeout applied to a request to the origin",
        ],
      },
    ],
  },
  {
    id: "vocab-stampede",
    deck: "vocabulary",
    prompt: "Cache stampede",
    answer:
      "A hot key expiring and sending every concurrent reader to the origin at once",
    topicIds: ["caching.stampede"],
    tier: 1,
    speed: [
      {
        question: "Cache stampede",
        correct:
          "A hot key expiring and sending every concurrent reader to the origin at once",
        distractors: [
          "The cache filling up and evicting entries faster than it fills",
          "Every client retrying at the same moment after a failure",
          "A cold cache after a deploy slowly warming up",
        ],
      },
    ],
  },
  {
    id: "vocab-cdn",
    deck: "vocabulary",
    prompt: "CDN",
    answer:
      "Servers near users that cache content so requests never reach your origin",
    topicIds: ["caching.cdn"],
    tier: 1,
    speed: [
      {
        question: "CDN",
        correct:
          "Servers near users that cache content so requests never reach your origin",
        distractors: [
          "A load balancer that routes users to their nearest region",
          "A cache sitting between your app and your database",
          "A network of replicas kept in sync across regions",
        ],
      },
    ],
  },
  {
    id: "vocab-backpressure",
    deck: "vocabulary",
    prompt: "Backpressure",
    answer: "A slow consumer signalling upstream to slow down",
    topicIds: ["messaging.backpressure"],
    tier: 1,
    speed: [
      {
        question: "Backpressure",
        correct: "A slow consumer signalling upstream to slow down",
        distractors: [
          "Messages accumulating when consumers cannot keep up",
          "Rejecting requests once a rate limit is exceeded",
          "Retrying a failed message after a delay",
        ],
      },
    ],
  },
  {
    id: "vocab-consumer-lag",
    deck: "vocabulary",
    prompt: "Consumer lag",
    answer:
      "How many records sit between a consumer's position and the end of the log",
    topicIds: ["messaging.consumer-lag"],
    tier: 1,
    speed: [
      {
        question: "Consumer lag",
        correct:
          "How many records sit between a consumer's position and the end of the log",
        distractors: [
          "The delay between publishing and the broker acknowledging",
          "How long a consumer takes to process one record",
          "The gap between a follower and the leader of a partition",
        ],
      },
    ],
  },
  {
    id: "vocab-dlq-term",
    deck: "vocabulary",
    prompt: "Dead-letter queue",
    answer:
      "Where a message goes after failing too many times, so the line can drain",
    topicIds: ["messaging.dlq"],
    tier: 1,
    speed: [
      {
        question: "Dead-letter queue",
        correct:
          "Where a message goes after failing too many times, so the line can drain",
        distractors: [
          "A queue of messages waiting for a consumer to start",
          "A queue holding messages scheduled for later delivery",
          "The log of messages already processed successfully",
        ],
      },
    ],
  },
  {
    id: "vocab-offset",
    deck: "vocabulary",
    prompt: "Offset",
    answer:
      "A record's position in its partition, and the bookmark a consumer commits",
    topicIds: ["messaging.offsets"],
    tier: 1,
    speed: [
      {
        question: "Offset",
        correct:
          "A record's position in its partition, and the bookmark a consumer commits",
        distractors: [
          "The identifier of the partition a record was written to",
          "The time difference between producer and broker clocks",
          "The number of unacknowledged records in flight",
        ],
      },
    ],
  },
  {
    id: "vocab-at-least-once",
    deck: "vocabulary",
    prompt: "At-least-once delivery",
    answer: "Every message arrives, and some may arrive more than once",
    topicIds: ["messaging.delivery-semantics"],
    tier: 1,
    speed: [
      {
        question: "At-least-once delivery",
        correct: "Every message arrives, and some may arrive more than once",
        distractors: [
          "Every message arrives exactly one time",
          "Messages may be lost but are never duplicated",
          "Messages arrive in the order they were sent",
        ],
      },
    ],
  },
  {
    id: "vocab-outbox-term",
    deck: "vocabulary",
    prompt: "Transactional outbox",
    answer:
      "Writing the event into the same transaction as the state change, then relaying it",
    topicIds: ["transactions.outbox"],
    tier: 1,
    speed: [
      {
        question: "Transactional outbox",
        correct:
          "Writing the event into the same transaction as the state change, then relaying it",
        distractors: [
          "Publishing the event first and writing state only on success",
          "Keeping undelivered messages in memory until acknowledged",
          "Batching events and publishing them on a schedule",
        ],
      },
    ],
  },
  {
    id: "vocab-saga",
    deck: "vocabulary",
    prompt: "Saga",
    answer:
      "A sequence of local transactions, each with a compensating action if a later one fails",
    topicIds: ["transactions.sagas"],
    tier: 1,
    speed: [
      {
        question: "Saga",
        correct:
          "A sequence of local transactions, each with a compensating action if a later one fails",
        distractors: [
          "A distributed transaction coordinated by two-phase commit",
          "A long-running process that holds locks across services",
          "A retry policy applied across a chain of service calls",
        ],
      },
    ],
  },
  {
    id: "vocab-circuit-breaker-term",
    deck: "vocabulary",
    prompt: "Circuit breaker",
    answer:
      "A switch that stops calling a failing dependency until it recovers",
    topicIds: ["reliability.circuit-breaker"],
    tier: 1,
    speed: [
      {
        question: "Circuit breaker",
        correct:
          "A switch that stops calling a failing dependency until it recovers",
        distractors: [
          "A limit on how long any single call may take",
          "A cap on how many requests a client may send per second",
          "A queue that buffers calls while a dependency is down",
        ],
      },
    ],
  },
  {
    id: "vocab-bulkhead",
    deck: "vocabulary",
    prompt: "Bulkhead",
    answer:
      "Isolating resources so one failing dependency cannot consume the whole pool",
    topicIds: ["reliability.bulkheads"],
    tier: 1,
    speed: [
      {
        question: "Bulkhead",
        correct:
          "Isolating resources so one failing dependency cannot consume the whole pool",
        distractors: [
          "Stopping calls to a dependency that is clearly down",
          "Running duplicate instances in separate availability zones",
          "Shedding low-priority traffic when under load",
        ],
      },
    ],
  },
  {
    id: "vocab-blast-radius",
    deck: "vocabulary",
    prompt: "Blast radius",
    answer: "How much of the system one failure can take with it",
    topicIds: ["reliability.failure-domains"],
    tier: 1,
    speed: [
      {
        question: "Blast radius",
        correct: "How much of the system one failure can take with it",
        distractors: [
          "The time taken for a failure to be detected",
          "The number of users affected by a deployment",
          "The rate at which a failure spreads between services",
        ],
      },
    ],
  },
  {
    id: "vocab-failure-domain-term",
    deck: "vocabulary",
    prompt: "Failure domain",
    answer: "A set of things that fail together — a host, a rack, a zone",
    topicIds: ["reliability.failure-domains"],
    tier: 1,
    speed: [
      {
        question: "Failure domain",
        correct: "A set of things that fail together — a host, a rack, a zone",
        distractors: [
          "The set of services affected by one component failing",
          "The boundary within which a transaction is atomic",
          "The region a piece of data is legally allowed to reside in",
        ],
      },
    ],
  },
  {
    id: "vocab-horizontal-scaling",
    deck: "vocabulary",
    prompt: "Horizontal scaling",
    answer: "Adding more machines rather than making one bigger",
    topicIds: ["scaling.vertical-vs-horizontal"],
    tier: 1,
    speed: [
      {
        question: "Horizontal scaling",
        correct: "Adding more machines rather than making one bigger",
        distractors: [
          "Adding CPU and memory to existing machines",
          "Splitting the dataset across more nodes",
          "Adding replicas to serve more read traffic",
        ],
      },
    ],
  },
  {
    id: "vocab-stateless",
    deck: "vocabulary",
    prompt: "Stateless",
    answer:
      "No request depends on data held in one particular instance's memory",
    topicIds: ["scaling.statelessness"],
    tier: 1,
    speed: [
      {
        question: "Stateless",
        correct:
          "No request depends on data held in one particular instance's memory",
        distractors: [
          "The service stores no data at all, anywhere",
          "Each request is independent of every other request",
          "The service can be restarted without losing data",
        ],
      },
    ],
  },
  {
    id: "vocab-autoscaling",
    deck: "vocabulary",
    prompt: "Autoscaling",
    answer: "Adding and removing instances automatically in response to load",
    topicIds: ["scaling.autoscaling"],
    tier: 1,
    speed: [
      {
        question: "Autoscaling",
        correct:
          "Adding and removing instances automatically in response to load",
        distractors: [
          "Routing traffic to the least loaded instance",
          "Increasing an instance's resources without a restart",
          "Pre-provisioning capacity ahead of an expected spike",
        ],
      },
    ],
  },
  {
    id: "vocab-rate-limiting",
    deck: "vocabulary",
    prompt: "Rate limiting",
    answer: "Rejecting requests from a client once it exceeds an allowed rate",
    topicIds: ["security.rate-limiting"],
    tier: 1,
    speed: [
      {
        question: "Rate limiting",
        correct:
          "Rejecting requests from a client once it exceeds an allowed rate",
        distractors: [
          "Slowing responses down so clients naturally back off",
          "Queueing excess requests until capacity frees up",
          "Distributing requests evenly across available instances",
        ],
      },
    ],
  },
  {
    id: "vocab-authn-authz",
    deck: "vocabulary",
    prompt: "Authorization (vs authentication)",
    answer: "Deciding what you may do, once it is established who you are",
    topicIds: ["security.authn-vs-authz"],
    tier: 1,
    speed: [
      {
        question: "Authorization (vs authentication)",
        correct: "Deciding what you may do, once it is established who you are",
        distractors: [
          "Establishing who you are, before deciding what you may do",
          "Verifying a token has not expired or been tampered with",
          "Encrypting a request so only the recipient can read it",
        ],
      },
    ],
  },
  {
    id: "vocab-encryption-at-rest-term",
    deck: "vocabulary",
    prompt: "Encryption at rest",
    answer:
      "Stored data is encrypted on disk, so a lost disk or backup discloses nothing",
    topicIds: ["security.encryption-at-rest"],
    tier: 1,
    speed: [
      {
        question: "Encryption at rest",
        correct:
          "Stored data is encrypted on disk, so a lost disk or backup discloses nothing",
        distractors: [
          "Data is encrypted as it travels between services",
          "Sensitive fields are replaced by tokens before storage",
          "Access to the data is logged and audited",
        ],
      },
    ],
  },
  {
    id: "vocab-blue-green-term",
    deck: "vocabulary",
    prompt: "Blue/green deployment",
    answer: "Two full environments, with traffic cut from one to the other",
    topicIds: ["delivery.blue-green"],
    tier: 1,
    speed: [
      {
        question: "Blue/green deployment",
        correct:
          "Two full environments, with traffic cut from one to the other",
        distractors: [
          "Releasing to a small share of traffic and watching metrics",
          "Replacing instances a few at a time until all are new",
          "Shipping code disabled, then enabling it by configuration",
        ],
      },
    ],
  },
  {
    id: "vocab-canary-term",
    deck: "vocabulary",
    prompt: "Canary release",
    answer:
      "Sending a small share of traffic to the new version and comparing metrics",
    topicIds: ["delivery.canary"],
    tier: 1,
    speed: [
      {
        question: "Canary release",
        correct:
          "Sending a small share of traffic to the new version and comparing metrics",
        distractors: [
          "Running two complete environments and switching between them",
          "Deploying to an internal audience before the public",
          "Rolling instances over one at a time",
        ],
      },
    ],
  },
  {
    id: "vocab-feature-flag",
    deck: "vocabulary",
    prompt: "Feature flag",
    answer: "A switch that decides whether deployed code is reachable",
    topicIds: ["delivery.feature-flags"],
    tier: 1,
    speed: [
      {
        question: "Feature flag",
        correct: "A switch that decides whether deployed code is reachable",
        distractors: [
          "A label marking which release a change belongs to",
          "A configuration value tuned per environment",
          "A toggle enabling verbose logging for one request",
        ],
      },
    ],
  },
  {
    id: "vocab-egress",
    deck: "vocabulary",
    prompt: "Egress",
    answer: "Data leaving a provider's network, and the charge for it",
    topicIds: ["cost.egress"],
    tier: 1,
    speed: [
      {
        question: "Egress",
        correct: "Data leaving a provider's network, and the charge for it",
        distractors: [
          "Data entering a provider's network from outside",
          "Traffic between availability zones within one region",
          "The bandwidth limit applied to a single instance",
        ],
      },
    ],
  },
  {
    id: "vocab-eventual-consistency",
    deck: "vocabulary",
    prompt: "Eventual consistency",
    answer:
      "Replicas converge on the same value if writes stop, but reads may be stale meanwhile",
    topicIds: ["consistency.eventual"],
    tier: 1,
    speed: [
      {
        question: "Eventual consistency",
        correct:
          "Replicas converge on the same value if writes stop, but reads may be stale meanwhile",
        distractors: [
          "Reads always see the most recent write, after a short delay",
          "Writes are applied in the same order on every replica",
          "Conflicts are impossible because only one node accepts writes",
        ],
      },
    ],
  },
  {
    id: "vocab-read-your-writes-term",
    deck: "vocabulary",
    prompt: "Read-your-writes",
    answer:
      "After you write, your own subsequent reads see it — others may not yet",
    topicIds: ["consistency.read-your-writes"],
    tier: 1,
    speed: [
      {
        question: "Read-your-writes",
        correct:
          "After you write, your own subsequent reads see it — others may not yet",
        distractors: [
          "Everyone sees your write as soon as it is acknowledged",
          "You never see a value older than one you have already seen",
          "Your reads and writes go to the same replica",
        ],
      },
    ],
  },
  {
    id: "vocab-observability-term",
    deck: "vocabulary",
    prompt: "Observability",
    answer:
      "Being able to answer questions about the system's behaviour from its outputs",
    topicIds: ["observability.metrics-logs-traces"],
    tier: 1,
    speed: [
      {
        question: "Observability",
        correct:
          "Being able to answer questions about the system's behaviour from its outputs",
        distractors: [
          "Collecting metrics, logs and traces from every service",
          "Alerting on-call when a threshold is crossed",
          "The proportion of the system covered by health checks",
        ],
      },
    ],
  },
  {
    id: "vocab-trace",
    deck: "vocabulary",
    prompt: "Distributed trace",
    answer:
      "The record of one request's path and timing across every service it touched",
    topicIds: ["observability.metrics-logs-traces"],
    tier: 1,
    speed: [
      {
        question: "Distributed trace",
        correct:
          "The record of one request's path and timing across every service it touched",
        distractors: [
          "A time series of one measurement across the fleet",
          "The ordered log lines produced by a single service",
          "A snapshot of what every thread was doing at one moment",
        ],
      },
    ],
  },
  {
    id: "vocab-cardinality-term",
    deck: "vocabulary",
    prompt: "Cardinality (metrics)",
    answer:
      "The number of distinct label combinations, each of which costs its own time series",
    topicIds: ["observability.cardinality"],
    tier: 1,
    speed: [
      {
        question: "Cardinality (metrics)",
        correct:
          "The number of distinct label combinations, each of which costs its own time series",
        distractors: [
          "The number of metrics a service exports",
          "How frequently a metric is sampled",
          "The retention period configured for a metric",
        ],
      },
    ],
  },
  {
    id: "vocab-idempotency-key-term",
    deck: "vocabulary",
    prompt: "Idempotency key",
    answer:
      "A client-generated identifier that lets the server recognise a retry of the same operation",
    topicIds: ["transactions.idempotency"],
    tier: 1,
    speed: [
      {
        question: "Idempotency key",
        correct:
          "A client-generated identifier that lets the server recognise a retry of the same operation",
        distractors: [
          "A server-generated id returned with the first response",
          "A hash of the request body used to detect duplicates",
          "A token proving the client is allowed to retry",
        ],
      },
    ],
  },
]
