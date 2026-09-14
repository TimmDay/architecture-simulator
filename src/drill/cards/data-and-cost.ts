import type { Card } from "../types"

export const dataAndCostCards: Card[] = [
  {
    id: "replica-vs-backup",
    prompt:
      "A read replica and a backup both give you 'another copy'. What is each actually for, and which one does durability?",
    answer:
      "A replica is an availability and read-scaling tool: a live copy that can serve reads or be promoted on failover, with an RPO near zero but no protection against logical damage -- a DROP TABLE or a bad migration replicates faithfully and instantly. A backup is a durability tool: a point-in-time copy you can restore from after corruption or deletion. Durability is backups. Availability is replicas. They are not substitutes.",
    emFraming:
      "The board-level version: replication protects against hardware failure, backups protect against you. Ask when the restore path was last actually exercised -- an untested backup is a belief, not a capability.",
    topicIds: [
      "replication.leader-follower",
      "replication.rpo-rto",
      "reliability.redundancy",
    ],
    tier: 1,
    speed: {
      question: "Which protects you from a bad migration that drops a table?",
      correct: "A backup — a replica applies the DROP faithfully and instantly",
      distractors: [
        "A read replica, which can be promoted to the state before the change",
        "A standby in another availability zone",
        "Synchronous replication, which would have refused the write",
      ],
    },
  },
  {
    id: "rpo-rto",
    prompt: "Define RPO and RTO, and say what each one costs to reduce.",
    answer:
      "RPO (recovery point objective) is how much data you can afford to lose, measured in time -- driven by replication mode and backup frequency. RTO (recovery time objective) is how long you can afford to be down -- driven by failover automation and restore speed. Lowering RPO costs write latency (synchronous replication) or storage (more frequent backups). Lowering RTO costs standby infrastructure you pay for and rarely use.",
    emFraming:
      "These are business decisions wearing technical clothes. Get the product owner to say the numbers out loud before you design; 'zero' is not an answer, it is a budget request.",
    topicIds: ["replication.rpo-rto", "replication.failover"],
    tier: 1,
    speed: {
      question: "What does lowering RPO cost you?",
      correct:
        "Write latency, from synchronous replication, or storage from more frequent backups",
      distractors: [
        "Standby infrastructure you pay for and rarely use",
        "Read throughput, since replicas spend capacity confirming writes",
        "Nothing, if the database is already replicated",
      ],
    },
  },
  {
    id: "async-replication-failover",
    prompt:
      "Your primary dies and you fail over to an asynchronous replica. What have you just done?",
    answer:
      "Lost every write that was acknowledged by the primary but had not yet reached the replica -- the replication lag window, typically hundreds of milliseconds to seconds of transactions. Those writes were confirmed to users. If the old primary later comes back, you also risk split-brain: two nodes believing they are primary, with divergent histories that must be reconciled or discarded.",
    emFraming:
      "This is the trade nobody makes explicitly: asynchronous replication means your durability guarantee has a hole exactly the size of your lag, and you only discover the size during the incident. Fencing the old primary is not optional.",
    topicIds: [
      "replication.failover",
      "replication.lag",
      "replication.split-brain",
    ],
    tier: 1,
    speed: {
      question: "You fail over to an async replica. What just happened?",
      correct:
        "Every write acknowledged but not yet replicated is gone — and users were told they succeeded",
      distractors: [
        "Nothing is lost; the replica catches up from the primary's log after promotion",
        "Reads become stale for the replication lag window, then recover",
        "Writes are rejected until the old primary is fenced",
      ],
    },
  },
  {
    id: "hot-key",
    prompt: "What is a hot key, and why does adding shards not fix it?",
    answer:
      "A single partition key receiving a disproportionate share of traffic -- a celebrity account, a viral item, a tenant 100x bigger than the rest. Adding shards does not help because the key hashes to exactly one shard no matter how many there are; you have added capacity everywhere except where the load is. Fixes are key-level: salt the key into sub-keys, cache that key specifically, or give the outlier dedicated capacity.",
    emFraming:
      "Sharding assumes a roughly uniform key distribution and real workloads are Zipfian. Ask for the p99 partition load, not the mean -- the mean will look healthy right up to the incident.",
    topicIds: [
      "partitioning.hot-keys",
      "partitioning.strategies",
      "partitioning.rebalancing",
    ],
    tier: 2,
    speed: {
      question: "Why does adding shards not fix a hot key?",
      correct:
        "The key hashes to one shard however many there are — you added capacity everywhere but there",
      distractors: [
        "Rebalancing moves the hot key to a new shard, which then becomes hot",
        "Each shard must still hold a copy of the hot key for consistency",
        "It does fix it, as long as you use consistent hashing",
      ],
    },
  },
  {
    id: "idempotency-key",
    prompt:
      "A payment API client times out and retries. How do you stop the customer being charged twice?",
    answer:
      "An idempotency key: the client generates a unique key per logical operation and sends it with every attempt. The server records the key with the result of the first successful execution, and any later request with the same key returns the stored result instead of executing again. The key must be persisted atomically with the side effect, or the window between them reintroduces the bug.",
    emFraming:
      "Note the client must generate the key, not the server -- a server-generated key cannot be reused by a retry that never got a response. This is the one design detail that separates payment integrations that work from ones that generate support tickets.",
    topicIds: ["transactions.idempotency", "reliability.retries-and-jitter"],
    tier: 1,
    speed: {
      question: "Who must generate an idempotency key, and why?",
      correct:
        "The client, per logical operation — a server-generated key cannot help a retry that got no response",
      distractors: [
        "The server, so it can guarantee global uniqueness",
        "The load balancer, so all retries of one request route together",
        "The database, using the primary key of the row being written",
      ],
    },
  },
  {
    id: "saga-vs-2pc",
    prompt:
      "Why do microservices usually use sagas rather than two-phase commit?",
    answer:
      "2PC holds locks across services for the duration of the transaction and requires every participant plus the coordinator to be available; a coordinator failure can leave participants blocked holding locks. A saga is a sequence of local transactions, each with a compensating action, so nothing is held across service boundaries -- at the cost of giving up isolation: intermediate states are visible, and 'rollback' means running a semantic undo, not restoring the prior state.",
    emFraming:
      "The product consequence is the part to surface: a compensated order is not an order that never happened, it is an order that was placed and then cancelled, and the customer may have seen it. Design the compensations with the product owner, not just the engineers.",
    topicIds: [
      "transactions.sagas",
      "transactions.two-phase-commit",
      "transactions.acid",
    ],
    tier: 2,
    speed: {
      question: "What does a saga give up compared to two-phase commit?",
      correct:
        "Isolation — intermediate states are visible, and rollback means running a semantic undo",
      distractors: [
        "Atomicity — some steps may simply never run",
        "Durability — completed steps can be lost on coordinator failure",
        "Nothing; it is strictly better, which is why microservices use it",
      ],
    },
  },
  {
    id: "outbox",
    prompt:
      "Why can you not just write to the database and then publish an event?",
    answer:
      "The two operations are not atomic. If the process dies between them, the state changed and no event was published; if you publish first and the commit fails, you announced something that did not happen. The transactional outbox pattern fixes it: write the event into an outbox table inside the same database transaction as the state change, then a separate relay reads the outbox and publishes, at-least-once.",
    emFraming:
      "This is the single most common source of 'the data is right but the downstream system disagrees' bugs, and it is invisible in testing because the failure window is milliseconds wide.",
    topicIds: ["transactions.outbox", "messaging.delivery-semantics"],
    tier: 2,
    speed: {
      question:
        "Why can you not just write to the database and then publish the event?",
      correct:
        "They are not atomic — a crash between them leaves state changed with no event, or vice versa",
      distractors: [
        "Publishing is slower than the write, so it blows the latency budget",
        "The broker may reorder the event relative to the database write",
        "The event may be published before the transaction's isolation level allows reading it",
      ],
    },
  },
  {
    id: "unit-economics",
    prompt:
      "What is the question that turns an infrastructure bill into an engineering decision?",
    answer:
      "Cost per unit of business value -- per request, per tenant, per order, per active user. An absolute bill tells you nothing about whether it is too high; cost per order trending up while order volume is flat tells you exactly where to look, and cost per order falling as you scale tells you the architecture is working.",
    emFraming:
      "As a manager this is the number to be able to quote. It converts 'infrastructure is expensive' into 'we spend $0.004 per order and it was $0.003 last quarter', which is a conversation that can actually be had with a finance team.",
    topicIds: ["cost.unit-economics", "cost.right-sizing"],
    tier: 1,
    speed: {
      question:
        "What turns an infrastructure bill into an engineering decision?",
      correct:
        "Cost per unit of business value — per order, per tenant, per active user",
      distractors: [
        "A month-over-month trend of the absolute spend",
        "Comparing your bill against a competitor's published pricing",
        "Tagging every resource by team so costs can be attributed",
      ],
    },
  },
  {
    id: "conways-law",
    prompt:
      "State Conway's Law and its practical consequence for an architecture you are about to propose.",
    answer:
      "Organisations design systems that mirror their own communication structures. The practical consequence: if you propose a service decomposition that does not match team boundaries, either the architecture will drift back toward the org chart, or the teams will be in constant cross-team coordination. The 'inverse Conway manoeuvre' is to change the team structure deliberately to get the architecture you want.",
    emFraming:
      "The most directly actionable law on this list for an engineering manager, because you control one of the two variables. A service owned by three teams will have the interfaces of a committee.",
    topicIds: [
      "org.conways-law",
      "org.ownership-boundaries",
      "styles.microservices",
    ],
    tier: 1,
    speed: {
      question:
        "What is the practical consequence of Conway's Law for a proposed architecture?",
      correct:
        "If the service boundaries do not match team boundaries, one of the two will move",
      distractors: [
        "Smaller teams inevitably produce simpler systems",
        "Architecture documents should be written by the team that will own the code",
        "Communication overhead grows quadratically, so teams should be kept under seven people",
      ],
    },
  },
  {
    id: "n-plus-one-api",
    prompt:
      "What is the N+1 problem in a service architecture, and why does it hide so well in testing?",
    answer:
      "One inbound request fans out into N downstream calls -- fetch a list, then call a service once per item. It hides in testing because with 5 test records it is 6 fast calls; in production with 500 records it is 501 calls, and the latency is the sum plus the tail. Each downstream call also multiplies load on the callee, so the fanout is a traffic amplifier as well as a latency problem.",
    emFraming:
      "In a distributed system the network cost dominates and the p99 of the slowest of N calls governs your response time -- with N=100 you are essentially guaranteed to hit someone's p99 on every request. Batch endpoints exist for this reason.",
    topicIds: ["api.n-plus-one", "fundamentals.percentiles"],
    tier: 1,
    speed: {
      question: "Why does an N+1 hide so well in testing?",
      correct:
        "With five test records it is six fast calls; with five hundred it is 501",
      distractors: [
        "Test environments mock the downstream service entirely",
        "It only appears when the downstream service is under load",
        "Connection pooling masks it until the pool is exhausted",
      ],
    },
  },
]
