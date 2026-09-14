import type { Card } from "../types"

export const messagingCards: Card[] = [
  {
    id: "queue-vs-log",
    prompt:
      "What is the difference between a queue and a log, and when does it decide your design?",
    answer:
      "A queue delivers each message to one consumer and deletes it on acknowledgement; a log is an ordered, retained sequence that many independent consumers read at their own offsets, and reading does not consume. It decides your design when you need replay, multiple independent consumers of the same events, or to add a new consumer that must process history -- all of which a log gives you and a queue does not.",
    emFraming:
      "Shorthand: queue for work distribution, log for event distribution. The expensive mistake is building a queue-based integration and later needing to add a second consumer or reprocess a week of data.",
    topicIds: ["messaging.queue-vs-log"],
    tier: 1,
    speed: {
      question: "What can a log do that a queue cannot?",
      correct:
        "Let several independent consumers each read every message, and replay history",
      distractors: [
        "Guarantee messages are processed in the order they were sent",
        "Deliver each message to exactly one consumer",
        "Retry a failed message without blocking the ones behind it",
      ],
    },
  },
  {
    id: "exactly-once",
    prompt:
      "Is exactly-once delivery possible? What do systems that claim it actually provide?",
    answer:
      "Not over an unreliable network as a delivery guarantee -- the two-generals problem means the sender can never be certain an acknowledgement was lost or the message was. What real systems provide is at-least-once delivery plus effectively-once processing: deduplication by message ID, idempotent consumers, or atomic offset-commit-with-side-effect within one transactional boundary.",
    emFraming:
      "When a vendor says exactly-once, the useful follow-up is 'within what boundary?'. It is usually true inside their system and false at the edge where you call an external API or write to another store.",
    topicIds: ["messaging.delivery-semantics", "transactions.idempotency"],
    tier: 1,
    speed: {
      question: "What do systems claiming exactly-once actually provide?",
      correct:
        "At-least-once delivery plus effectively-once processing, via dedup or idempotency",
      distractors: [
        "True exactly-once delivery, using two-phase commit with the broker",
        "At-most-once delivery, dropping anything it cannot confirm",
        "Exactly-once within one partition, at-least-once across partitions",
      ],
    },
  },
  {
    id: "backpressure",
    prompt:
      "What is backpressure, and what happens in a pipeline that has none?",
    answer:
      "A mechanism by which a slow consumer signals upstream to slow down -- bounded buffers that block or reject, flow-control credits, or rejecting requests at admission. Without it, a fast producer and a slow consumer means an unbounded queue: memory grows until the process dies, or latency grows until every message in the queue is useless by the time it is processed.",
    emFraming:
      "The insidious version is that the system does not fail, it just gets slower and slower while every dashboard stays green -- throughput looks fine, and consumer lag is the only metric that reveals it. Alert on lag and on queue depth, not on error rate.",
    topicIds: ["messaging.backpressure", "messaging.consumer-lag"],
    tier: 1,
    speed: {
      question: "A pipeline has no backpressure. What actually happens?",
      correct:
        "Nothing errors — the queue grows until memory dies or the data is too stale to matter",
      distractors: [
        "The producer receives errors and slows down on its own",
        "Messages are dropped once the buffer is full, and the error rate climbs",
        "The consumer crashes immediately and the pipeline stops",
      ],
    },
  },
  {
    id: "dlq",
    prompt:
      "What problem does a dead-letter queue solve, and what new problem does it create?",
    answer:
      "It solves the poison message: one message that always fails, blocking the partition or being retried forever. After N failures it is moved aside so the pipeline drains. The new problem is that a DLQ nobody monitors is a silent data-loss mechanism -- messages disappear from the system successfully and nobody notices for months.",
    emFraming:
      "A DLQ without an alert on its depth, and a named owner for draining it, is worse than no DLQ, because it converts a loud failure into a quiet one.",
    topicIds: ["messaging.dlq", "messaging.ordering"],
    tier: 2,
    speed: {
      question: "What new problem does a dead-letter queue create?",
      correct:
        "An unmonitored DLQ is silent data loss — messages vanish successfully",
      distractors: [
        "Messages in it are delivered out of order when replayed",
        "It doubles storage cost for every message in the system",
        "Consumers must now handle two queues in the same transaction",
      ],
    },
  },
  {
    id: "fanout-write-vs-read",
    prompt:
      "Fanout-on-write versus fanout-on-read for an activity feed: what is the trade, and where does each break?",
    answer:
      "Fanout-on-write pushes each post into every follower's precomputed feed: reads are a single cheap lookup, writes are O(followers). Fanout-on-read assembles the feed at request time from the people you follow: writes are cheap, reads are expensive. Write-fanout breaks on celebrity accounts (one post, 50M feed writes); read-fanout breaks on users following thousands of accounts at read latency.",
    emFraming:
      "The real answer at scale is hybrid: fanout-on-write for ordinary accounts, fanout-on-read for the handful of celebrities, merged at read time. Being able to say 'hybrid, and here is where the boundary sits' is the senior answer.",
    topicIds: ["messaging.fanout", "partitioning.hot-keys"],
    tier: 2,
    speed: {
      question: "Where does fanout-on-write break?",
      correct:
        "Celebrity accounts — one post becomes fifty million feed writes",
      distractors: [
        "Users who follow thousands of accounts, making each read expensive",
        "Feeds that must be strictly ordered by timestamp",
        "Accounts that post very rarely, leaving feeds cold",
      ],
    },
  },
]
