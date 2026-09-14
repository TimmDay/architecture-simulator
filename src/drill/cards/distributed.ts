import type { Card } from "../types"

export const distributedCards: Card[] = [
  {
    id: "cp-behaviour",
    prompt:
      "During a network partition, how does a CP system behave, and what does the user see?",
    answer:
      "It refuses to serve requests it cannot answer correctly. The minority side of the partition stops accepting writes — and usually reads that must be current — rather than risk diverging from the majority, so those users get errors or timeouts. The majority side, if it still has a quorum, carries on normally. When the partition heals there is nothing to reconcile, because divergence was never allowed to happen. You have traded availability for the guarantee that anything you did serve was correct.",
    emFraming:
      "The right framing for the product conversation is: would you rather this be unavailable for four minutes, or serve two people the same seat? For inventory, balances and bookings, refusing is the cheaper failure.",
    topicIds: [
      "consistency.cap",
      "consistency.linearizability",
      "consistency.quorum-rw",
    ],
    tier: 1,
  },
  {
    id: "ap-behaviour",
    prompt:
      "During a partition, how does an AP system behave, and what has to happen after the partition heals?",
    answer:
      "Both sides keep accepting reads and writes, so nobody sees an error — and both sides diverge, because neither can see the other's writes. When the partition heals the divergence has to be reconciled: last-write-wins using timestamps (simple, and silently discards data), version vectors that detect the conflict and hand it to the application, or CRDTs whose merge is defined so that any order converges. The availability was real; the cost is that 'what is the current value' had more than one answer for a while, and something must decide.",
    emFraming:
      "The question to ask whenever a team says they are AP: what is your merge strategy, and who wrote it? If the answer is 'last write wins' by default, they have chosen to lose data silently — which may be fine for a presence indicator and is not fine for a shopping basket.",
    topicIds: [
      "consistency.cap",
      "consistency.eventual",
      "replication.multi-leader",
    ],
    tier: 1,
  },
  {
    id: "sql-nosql-consistency-fallacy",
    prompt:
      "Why is 'relational databases are consistent, NoSQL is eventually consistent' wrong?",
    answer:
      "Because consistency is a property of the configuration and the deployment, not of the data model. A single Postgres is strongly consistent; add asynchronous replicas and serve reads from them and it is eventually consistent. DynamoDB offers both eventually and strongly consistent reads on the same table. Cassandra's consistency is whatever your R and W settings make it. The relational/NoSQL distinction is about the data model, query language and scaling approach — the consistency question is answered by replication mode and read routing.",
    emFraming:
      "This matters because the shorthand leads teams to add read replicas to Postgres believing they still have strong consistency, then spend a week debugging read-your-writes bugs. Ask about the replication topology, not about the vendor.",
    topicIds: [
      "consistency.eventual",
      "data-stores.relational-vs-document",
      "replication.leader-follower",
    ],
    tier: 1,
  },
  {
    id: "when-strong-consistency",
    prompt:
      "Which kinds of state genuinely require strong consistency, and why?",
    answer:
      "State that is authoritative and carries an invariant that must never be violated: account balances, inventory and seat allocation, uniqueness of an identifier, permission and access decisions, idempotency records. The common thread is that two concurrent readers acting on stale information can produce an outcome that is not merely late but wrong and not automatically recoverable — a double-spend, an oversold seat, access granted after revocation. Everything else is usually derived state where staleness is a quality-of-service issue rather than a correctness one.",
    emFraming:
      "The useful test is whether a stale read can cause an irreversible side effect. 'The dashboard was ten seconds behind' costs nothing; 'the permission check was ten seconds behind' is an incident report.",
    topicIds: [
      "consistency.linearizability",
      "consistency.cap",
      "reliability.state-vs-compute",
    ],
    tier: 1,
  },
  {
    id: "when-eventual-consistency",
    prompt: "Where is eventual consistency clearly the right choice?",
    answer:
      "Derived state rebuilt from an authoritative source: search indexes, recommendation and activity feeds, analytics and dashboards, aggregate counters, caches, denormalised read models. All of them can be regenerated if lost, all tolerate being seconds or minutes behind, and none of them is the thing anybody makes an irreversible decision against. Accepting staleness in these buys enormous scale, because they can be replicated and cached freely without coordination.",
    emFraming:
      "The commitment that makes this safe is bounding the staleness and monitoring it. 'Eventually' without a number is a hope; 'the index is behind by under five seconds, and we alert at thirty' is a design.",
    topicIds: [
      "consistency.eventual",
      "messaging.consumer-lag",
      "observability.alerting-on-symptoms",
    ],
    tier: 1,
  },
  {
    id: "leader-follower-mechanics",
    prompt: "Describe the mechanics of leader/follower replication.",
    answer:
      "One node is the leader and is the only one that accepts writes. It appends every change to a log, and followers stream that log and apply the changes in the same order, so they converge on the same state. Reads can be served by followers, which scales reads. Replication is synchronous (the leader waits for a follower to acknowledge before confirming the write — safer, slower) or asynchronous (confirm immediately — faster, with a window of writes that exist only on the leader). On leader failure a follower is promoted, and with asynchronous replication anything still in that window is lost.",
    emFraming:
      "Two failure modes to name in review: replication lag breaking read-your-writes for users routed to a follower, and split-brain if the old leader returns without being fenced. Neither is exotic and both are usually discovered in production.",
    topicIds: [
      "replication.leader-follower",
      "replication.lag",
      "replication.failover",
      "replication.split-brain",
    ],
    tier: 1,
  },
  {
    id: "why-shard",
    prompt: "What problem does sharding actually solve, and what does it not?",
    answer:
      "It solves the limits of one machine: a dataset too large for one disk, a write rate beyond one node's capacity, or working data larger than memory. Splitting by key across nodes means each node holds and serves a fraction. It does not solve read scaling on its own (replicas are the cheaper answer), it does not help a hot key, and it does not make queries faster unless they carry the shard key. What it costs is joins across shards, transactions across shards, and a key choice that is expensive to change.",
    emFraming:
      "Sharding is the last resort, after vertical scaling, read replicas, caching and archiving cold data. Teams that shard early spend their complexity budget on a problem they did not yet have.",
    topicIds: ["partitioning.strategies", "scaling.vertical-vs-horizontal"],
    tier: 1,
  },
  {
    id: "shard-key-choice",
    prompt: "What makes a good shard key, and what makes a bad one?",
    answer:
      "A good key distributes writes and storage evenly, has high cardinality, and appears in the great majority of queries so they can be routed to one shard. A bad one is low-cardinality (country, status), monotonically increasing (a timestamp or auto-increment id, which sends every new write to the same shard), or absent from your most common access path, which forces a scatter-gather to every shard. The awkward truth is that the best key for distribution is often not the one your queries use, and you cannot have both.",
    emFraming:
      "This is close to irreversible — changing it means moving every row while serving traffic. It deserves more design time than almost any other decision in the system, and it should be chosen from real query patterns rather than from the data model.",
    topicIds: [
      "partitioning.shard-key",
      "partitioning.strategies",
      "partitioning.rebalancing",
    ],
    tier: 1,
  },
  {
    id: "cross-partition-queries",
    prompt:
      "Why are cross-partition queries expensive, beyond simply doing more work?",
    answer:
      "A query without the shard key becomes scatter-gather: it goes to every shard and cannot finish until the slowest responds, so its latency is the maximum rather than the average, and with enough shards you hit somebody's p99 on essentially every request. It also consumes capacity on every shard at once, so one expensive query type can saturate the whole fleet, and sorting, aggregating or paginating the merged result has to happen somewhere — usually in a coordinator that becomes its own bottleneck.",
    emFraming:
      "The standard fix is a purpose-built read model: a search index or a denormalised table keyed by the access pattern that does not carry the shard key, kept up to date asynchronously. That is a deliberate choice to hold the same data twice.",
    topicIds: [
      "partitioning.cross-shard-queries",
      "fundamentals.percentiles",
      "consistency.eventual",
    ],
    tier: 1,
  },
  {
    id: "cross-partition-invariants",
    prompt:
      "Why is it hard to maintain a global invariant — 'this username is unique', 'this balance never goes negative' — across partitions?",
    answer:
      "Because each shard can only enforce constraints over the data it holds. A unique index guarantees uniqueness within a partition, not across them, so if the value being constrained is not the partition key, two shards can each accept a write that is individually valid and jointly wrong. Enforcing it globally needs coordination: a dedicated single-shard table that owns the invariant, a distributed transaction with its locking and availability costs, or accepting the violation and detecting and compensating afterwards.",
    emFraming:
      "In practice the cheapest answer is usually to shard by the thing the invariant is about, so it becomes local again. When that is impossible, being explicit that the invariant is now eventually enforced — and that somebody is reconciling — beats assuming the database still has it.",
    topicIds: [
      "partitioning.global-invariants",
      "transactions.two-phase-commit",
      "transactions.sagas",
    ],
    tier: 2,
  },
]
