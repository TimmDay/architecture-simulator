import type { Card } from "../types"

export const realtimeConsensusCards: Card[] = [
  {
    id: "realtime-transports",
    prompt:
      "Long polling, Server-Sent Events and WebSockets: what does each cost, and how do you choose?",
    answer:
      "Long polling holds a request open until there is news, then the client immediately reconnects — it works through any proxy and needs no special infrastructure, at the cost of a connection setup per message and awkward handling when nothing happens. SSE is a single long-lived HTTP response the server streams into: one direction only, text only, with automatic reconnection and event ids built in, which makes it the right answer for feeds, notifications and progress. WebSockets upgrade to a full-duplex binary connection, which you need when the client sends frequently too — chat, collaborative editing, games — and which costs you a protocol that many proxies handle badly and a connection you must now keep alive, authenticate and scale.",
    emFraming:
      "The question that settles it is how often the client sends. If it is mostly listening, SSE is simpler in every way that matters and people reach past it out of habit. Reserve WebSockets for genuinely bidirectional traffic, and remember that mobile clients drop connections constantly, so reconnection and replay-from-last-event matter more than the transport choice itself.",
    topicIds: ["realtime.transport-choice", "realtime.push-vs-pull"],
    tier: 1,
    speed: [
      {
        question:
          "The client mostly listens and rarely sends. Which transport?",
        correct:
          "Server-Sent Events — one direction, auto-reconnect, works over plain HTTP",
        distractors: [
          "WebSockets, since they are strictly more capable",
          "Long polling, to avoid holding connections open",
          "gRPC streaming, for the binary efficiency",
        ],
      },
      {
        question:
          "What does SSE give you for free that a raw WebSocket does not?",
        correct:
          "Automatic reconnection with a last-event-id, so the client can resume",
        distractors: [
          "Binary frames without base64 encoding",
          "Bidirectional messaging on one connection",
          "Guaranteed delivery of every event",
        ],
      },
      {
        question:
          "What is the main operational cost of long-lived connections?",
        correct:
          "They are stateful — each one pins a client to an instance, so deploys and scaling drop them",
        distractors: [
          "They consume far more bandwidth than polling",
          "They cannot be load balanced at layer 7",
          "They require sticky sessions at the database",
        ],
      },
    ],
  },
  {
    id: "connection-scaling",
    prompt:
      "A million users hold open connections. What breaks first, and what does the architecture look like?",
    answer:
      "File descriptors and memory per connection break first — a few kilobytes each is gigabytes at a million — and then the fact that connections are stateful, so a deploy disconnects everyone at once and they all reconnect together. The shape that survives it: a stateless-as-possible connection tier that does nothing but hold sockets, a registry mapping user to the instance holding their socket, and a separate service that publishes messages to that registry rather than to sockets directly. Reconnection needs jittered backoff or the reconnect storm becomes the outage, and clients need to resume from a position rather than expecting the server to have held anything for them.",
    emFraming:
      "The insight worth carrying: the connection tier and the business logic scale on completely different axes, so keeping them in one service means scaling both for whichever hits its limit first. Splitting them is usually the first thing a chat or notification system does as it grows.",
    topicIds: [
      "realtime.connection-scaling",
      "reliability.state-vs-compute",
      "realtime.presence-and-fanout",
    ],
    tier: 1,
    speed: [
      {
        question:
          "What makes a deploy dangerous for a system holding a million WebSockets?",
        correct:
          "Every client disconnects at once and reconnects together — a self-inflicted thundering herd",
        distractors: [
          "In-flight messages are lost because they were never persisted",
          "The load balancer cannot drain long-lived connections",
          "Connection state has to be migrated to the new instances",
        ],
      },
      {
        question:
          "How does a message reach the right socket in a multi-instance connection tier?",
        correct:
          "A registry maps user to the instance holding their connection, and the publisher routes via it",
        distractors: [
          "Every instance receives every message and drops the ones it cannot deliver",
          "Sticky sessions ensure a user always reconnects to the same instance",
          "The database triggers a push to the socket directly",
        ],
      },
    ],
  },
  {
    id: "push-vs-pull",
    prompt: "When should a client poll, and when should the server push?",
    answer:
      "Poll when updates are rare relative to the number of clients, when staleness of a few seconds is fine, or when you cannot afford connection state — polling is stateless, trivially load balanced, and degrades gracefully. Push when updates are frequent, when latency matters to the user, or when polling would mean most requests returning nothing, which is pure waste multiplied by your user count. The crossover is roughly where polling cost exceeds connection cost: a million clients polling every five seconds is 200,000 requests a second, most of them empty, which is far more expensive than holding a million idle sockets.",
    emFraming:
      "A hybrid is often the honest answer: push a lightweight 'something changed' signal and let the client pull the detail. That keeps the push path cheap and stateless-ish, and means a missed notification is recoverable by the next poll rather than lost.",
    topicIds: [
      "realtime.push-vs-pull",
      "realtime.transport-choice",
      "cost.unit-economics",
    ],
    tier: 2,
    speed: [
      {
        question:
          "A million clients poll every 5 seconds. What is the request rate?",
        correct: "About 200,000 per second, most of them returning nothing",
        distractors: [
          "About 5,000 per second",
          "About 20,000 per second",
          "About 1,000,000 per second",
        ],
      },
      {
        question:
          "What is the advantage of pushing a 'something changed' signal and letting the client pull?",
        correct:
          "The push path stays cheap, and a missed signal is recovered by the next pull",
        distractors: [
          "It guarantees the client sees every individual change",
          "It removes the need for the client to authenticate the pull",
          "It lets the server batch updates into a single payload",
        ],
      },
    ],
  },
  {
    id: "raft-consensus",
    prompt:
      "What problem does a consensus algorithm like Raft solve, and what does it require to make progress?",
    answer:
      "Getting a group of nodes to agree on an ordered sequence of values, such that every node ends up with the same log even though nodes crash and messages are lost or reordered. Raft does it by electing one leader per term; the leader appends entries and commits one once a majority has acknowledged it, so any future leader must contain every committed entry. It needs a majority to make progress — three nodes tolerate one failure, five tolerate two — which means a minority partition cannot commit anything, and that is the point: it chooses consistency over availability deliberately.",
    emFraming:
      "You rarely implement this. What you do is recognise where you need it: leader election, cluster membership, configuration, distributed locks, anything where two nodes disagreeing is unacceptable. That is why the answer is usually 'put it in etcd or ZooKeeper' rather than writing it yourself, and why those systems are deliberately small and boring.",
    topicIds: [
      "consensus.raft",
      "consensus.leader-election",
      "consistency.cap",
    ],
    tier: 1,
    speed: [
      {
        question: "How many failures can a 5-node Raft cluster tolerate?",
        correct: "Two — it needs a majority of three to commit",
        distractors: [
          "Four — it only needs one node holding the data",
          "One — any two failures risk divergence",
          "Three — a minority of two can still serve reads",
        ],
      },
      {
        question:
          "What happens to the minority side of a partitioned Raft cluster?",
        correct:
          "It cannot commit anything — consistency is chosen over availability by design",
        distractors: [
          "It elects its own leader and reconciles after the partition heals",
          "It serves reads but rejects writes until the majority returns",
          "It blocks entirely, including reads, until quorum is restored",
        ],
      },
      {
        question:
          "Why do teams use etcd or ZooKeeper rather than implementing consensus?",
        correct:
          "Consensus is easy to get subtly wrong, and these are deliberately small and boring",
        distractors: [
          "They are faster than any application-level implementation",
          "They provide consensus without needing a majority",
          "Cloud providers require them for managed Kubernetes",
        ],
      },
    ],
  },
  {
    id: "fencing-tokens",
    prompt:
      "A node holding a distributed lock pauses for a long GC, its lease expires, another node takes the lock, then the first wakes up and writes. How do you prevent the corruption?",
    answer:
      "Fencing tokens. Every time the lock is granted the coordinator issues a monotonically increasing number, and the client must present it with every write to the protected resource. The storage layer remembers the highest token it has seen and rejects anything lower. So the paused node wakes holding token 33, the new holder has 34, and the stale write is refused by the resource itself rather than by a timeout nobody can rely on. Without this, a lock with a lease is only advisory — a pause longer than the lease silently breaks mutual exclusion.",
    emFraming:
      "The general lesson is that you cannot make a distributed lock safe with timeouts alone, because a process can be paused for arbitrarily long by GC, a hypervisor, or a slow disk, and it has no way to know it was. Safety has to be enforced at the resource, by something that can order the requests.",
    topicIds: [
      "consensus.fencing",
      "consensus.distributed-locks",
      "transactions.idempotency",
    ],
    tier: 1,
    speed: [
      {
        question: "What makes a distributed lock with only a lease unsafe?",
        correct:
          "A process can be paused longer than the lease and has no way to know it was",
        distractors: [
          "Leases cannot be renewed without a round trip to every node",
          "Clock drift means the lease expires at different times on different nodes",
          "Two clients can be granted the lease simultaneously under load",
        ],
      },
      {
        question: "Where is a fencing token actually checked?",
        correct:
          "At the resource being protected, which rejects any token lower than the highest it has seen",
        distractors: [
          "At the lock service, before the lock is granted",
          "By the client, before it issues the write",
          "By the load balancer, which routes stale requests away",
        ],
      },
    ],
  },
  {
    id: "coordination-services",
    prompt:
      "What do ZooKeeper and etcd actually give you, and what should you not use them for?",
    answer:
      "A small, strongly consistent, highly available store with primitives built on consensus: linearizable reads and writes on a modest amount of data, ephemeral entries tied to a session, watches that notify you of changes, and compare-and-swap. That is exactly enough to build leader election, service discovery, cluster membership, configuration, and distributed locks with fencing. What you should not use them for is bulk data or high write throughput — every write goes through consensus and is replicated to a majority, so they are deliberately slow and small, and treating one as a database is how you take down everything that depends on it at once.",
    emFraming:
      "Worth noticing that everything depending on it shares a failure domain: if your service discovery, config and leader election all live in one ZooKeeper ensemble, that ensemble is the availability ceiling for your whole platform. Teams discover this the first time it has a bad day.",
    topicIds: [
      "consensus.coordination-services",
      "consensus.leader-election",
      "reliability.failure-domains",
    ],
    tier: 2,
    speed: [
      {
        question: "What should you NOT store in etcd or ZooKeeper?",
        correct:
          "Bulk data or anything with high write throughput — every write goes through consensus",
        distractors: [
          "Cluster membership and which node is currently leader",
          "Configuration that must be consistent across the fleet",
          "Ephemeral entries representing live sessions",
        ],
      },
      {
        question: "What does an 'ephemeral' entry do?",
        correct:
          "Disappears when the session that created it ends, which is how liveness is detected",
        distractors: [
          "Expires after a fixed TTL regardless of the client",
          "Is stored in memory only and lost on restart",
          "Is visible only to the client that created it",
        ],
      },
    ],
  },
  {
    id: "crdts",
    prompt:
      "What is a CRDT, and when is it the right answer over last-write-wins?",
    answer:
      "A data type whose merge operation is commutative, associative and idempotent, so replicas that received the same updates in any order converge on the same state without coordination — counters, sets, and sequences for collaborative text all have well-known constructions. It is the right answer over last-write-wins when discarding a concurrent update would lose real user intent: two people adding different items to a shared list should end with both, not with whichever clock happened to be later. The cost is metadata — CRDTs carry causality information that grows with participants, and some, like text sequences, need tombstones that must eventually be collected.",
    emFraming:
      "Last-write-wins is not wrong, it is a choice to discard data silently, and it is fine for a presence indicator or a cursor position. The question to ask is what a lost concurrent update actually costs the user, and whether anyone would notice. For a shopping basket or a shared document, they would.",
    topicIds: [
      "consensus.crdts",
      "consistency.eventual",
      "replication.multi-leader",
    ],
    tier: 2,
    speed: [
      {
        question: "What property makes a CRDT converge without coordination?",
        correct:
          "Its merge is commutative, associative and idempotent, so order of delivery does not matter",
        distractors: [
          "Every replica applies updates in timestamp order",
          "A leader assigns a total order before replication",
          "Conflicting updates are rejected and retried by the client",
        ],
      },
      {
        question: "What does last-write-wins actually do on a conflict?",
        correct: "Silently discards the losing update",
        distractors: [
          "Merges both updates by taking the union",
          "Surfaces the conflict to the application to resolve",
          "Retries the losing write after the winner commits",
        ],
      },
    ],
  },
]
