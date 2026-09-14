import type { Card } from "../types"

export const kafkaCards: Card[] = [
  {
    id: "kafka-topic",
    prompt: "What is a Kafka topic, and how does it differ from a queue?",
    answer:
      "A named, append-only log of records, retained for a configured period regardless of who has read it. Producers append; consumers read from a position they control. Unlike a queue, reading does not consume — the record stays until it ages out — so many independent consumers can read the same topic without competing, and a new consumer can start from the beginning and process history. A topic is a durable record of what happened, not a work list of what remains to be done.",
    emFraming:
      "This is what makes 'add another consumer next quarter' a configuration change rather than a redesign, and it is the main reason to reach for a log when you cannot yet name every consumer.",
    topicIds: ["messaging.kafka-partitions", "messaging.queue-vs-log"],
    tier: 1,
    speed: {
      question: "What distinguishes a Kafka topic from a queue?",
      correct:
        "Reading does not consume — records are retained, so many consumers read all of them",
      distractors: [
        "It guarantees global ordering across all records",
        "It delivers each record exactly once, by design",
        "It stores records in memory rather than on disk",
      ],
    },
  },
  {
    id: "kafka-partitions",
    prompt:
      "What are partitions for, and what is the trade-off in choosing how many?",
    answer:
      "A topic is split into partitions, each an independent ordered log, and that is the unit of parallelism: a partition is consumed by exactly one member of a consumer group, so maximum consumer concurrency equals partition count. More partitions means more parallelism — but more open file handles and memory on brokers, longer leader elections, more end-to-end latency, and smaller batches. Crucially, partitions are easy to add and adding them changes which partition a key hashes to, breaking ordering for keys that move.",
    emFraming:
      "Pick partition count from the throughput you expect within a couple of years, not from today's. Adding partitions later is possible and disrupts key ordering, which is exactly the guarantee people were relying on.",
    topicIds: ["messaging.kafka-partitions", "messaging.ordering"],
    tier: 1,
    speed: {
      question: "What is the main cost of adding partitions later?",
      correct:
        "Keys rehash to different partitions, so per-key ordering breaks for keys that move",
      distractors: [
        "Existing records must be rewritten into the new layout",
        "Consumer groups must be recreated from the earliest offset",
        "The topic becomes unavailable for the duration of the change",
      ],
    },
  },
  {
    id: "kafka-ordering",
    prompt: "What ordering does Kafka actually guarantee?",
    answer:
      "Order is guaranteed within a partition and nowhere else. Records in one partition are read in exactly the order they were appended; records in different partitions have no defined relative order at all. Since a record's partition is chosen by hashing its key, all records with the same key land in the same partition and are therefore ordered relative to each other. Choosing the key is choosing your ordering guarantee.",
    emFraming:
      "The practical rule: key by the entity whose event order matters — the design id, the account id — and you get per-entity ordering with full parallelism across entities. Wanting global ordering means one partition, which means no parallelism, which almost always means you have misidentified the requirement.",
    topicIds: ["messaging.ordering", "messaging.kafka-partitions"],
    tier: 1,
    speed: {
      question: "What ordering does Kafka guarantee?",
      correct:
        "Within a partition only — records with the same key, since the key picks the partition",
      distractors: [
        "Across the whole topic, by the broker's receive timestamp",
        "Within a consumer group, in the order offsets were committed",
        "Across partitions, as long as the producer is single-threaded",
      ],
    },
  },
  {
    id: "kafka-consumer-groups",
    prompt:
      "How do consumer groups divide work, and what happens when membership changes?",
    answer:
      "Every consumer declares a group id. Within a group, each partition is assigned to exactly one member, so the group collectively processes each record once and scales by adding members — up to the partition count, after which extra members sit idle. Different groups are entirely independent and each receives every record. When a member joins, leaves or fails its heartbeat, the group rebalances: partitions are reassigned, and during that pause nobody is consuming.",
    emFraming:
      "Rebalances are the operational surprise. A slow consumer whose processing exceeds the poll timeout gets kicked out, which triggers a rebalance, which slows everyone down, which causes more timeouts. 'Consumer group stuck rebalancing' is usually a processing-time problem wearing a configuration costume.",
    topicIds: ["messaging.consumer-groups", "messaging.kafka-partitions"],
    tier: 1,
    speed: {
      question:
        "You have 4 partitions and 6 consumers in one group. What happens?",
      correct:
        "Four consume, two sit idle — a partition goes to exactly one member",
      distractors: [
        "All six share the four partitions, two records at a time",
        "The group rebalances continuously, splitting each partition",
        "Kafka creates two more partitions to match the group size",
      ],
    },
  },
  {
    id: "kafka-offsets",
    prompt: "What is an offset, and what does committing one actually mean?",
    answer:
      "A record's position in its partition, monotonically increasing. Each consumer group tracks, per partition, the offset it has committed — a durable bookmark saying 'everything before this is done'. On restart or reassignment the new owner resumes from the committed offset. Committing is therefore a claim about completed work, and the commit is separate from the processing: whether you commit before or after doing the work determines whether a crash loses messages or replays them.",
    emFraming:
      "Auto-commit on a timer is the default and quietly means at-most-once for anything still in flight when the process dies. If losing a record matters, commit after the work, accept replays, and make the handler idempotent.",
    topicIds: ["messaging.offsets", "messaging.delivery-semantics"],
    tier: 1,
    speed: {
      question: "What does committing an offset claim?",
      correct:
        "That everything before it is done — so committing before processing risks losing work",
      distractors: [
        "That the consumer has received the records into its buffer",
        "That the broker may delete those records from the log",
        "That the consumer group has rebalanced successfully",
      ],
    },
  },
  {
    id: "kafka-consumer-death",
    prompt:
      "A consumer reads a batch, processes half of it, and the process is killed. What happens?",
    answer:
      "Nothing was committed for that batch, so the group notices the missing heartbeat, rebalances, and another member takes over the partition from the last committed offset. Every record in that batch is delivered again — including the half already processed. Nothing is lost; some things happen twice. If instead the consumer had committed before processing, that half would have been skipped and silently lost.",
    emFraming:
      "This is the concrete reason at-least-once plus idempotent handlers is the default posture. Being able to walk through this failure precisely is usually what an interviewer is checking when they ask about consumer groups.",
    topicIds: [
      "messaging.offsets",
      "messaging.consumer-groups",
      "transactions.idempotency",
    ],
    tier: 1,
    speed: {
      question:
        "A consumer processes half a batch, then is killed before committing. What happens?",
      correct:
        "Another member takes over from the last commit, so the whole batch is delivered again",
      distractors: [
        "The uncommitted half is lost and the group moves past it",
        "The broker replays only the unprocessed records",
        "The partition is unavailable until the original consumer returns",
      ],
    },
  },
  {
    id: "idempotent-consumers",
    prompt:
      "Given at-least-once delivery, how do you make a consumer safe against duplicates?",
    answer:
      "Make the effect of processing a record repeatable. In order of preference: write absolute state rather than deltas, so a replay overwrites with the same values (an upsert keyed by the entity id); use a conditional update that only applies from the expected state; or keep a processed-records table keyed by the record's id or offset, written in the same transaction as the effect, and skip anything already present. External side effects — charges, emails — need an idempotency key carried to the downstream system.",
    emFraming:
      "The one to watch for is a consumer that increments a counter. It is correct in testing and wrong after the first rebalance, and the error is silent and cumulative.",
    topicIds: [
      "transactions.idempotency",
      "messaging.delivery-semantics",
      "transactions.upsert",
    ],
    tier: 1,
    speed: {
      question: "Which consumer is NOT safe against duplicate delivery?",
      correct: "One that increments a counter for each record",
      distractors: [
        "One that upserts a row keyed by the entity id",
        "One that applies a conditional update from an expected state",
        "One that records processed offsets in the same transaction as its write",
      ],
    },
  },
  {
    id: "compensating-actions",
    prompt:
      "In a saga, what is a compensating action, and why is it not the same as a rollback?",
    answer:
      "A new operation that semantically undoes a completed step — refund the payment, release the reservation, cancel the shipment. It is not a rollback because the original step really happened and was visible: other transactions may have read it, the customer may have been emailed, and downstream systems may have reacted. A rollback restores the prior state as though nothing occurred; a compensation moves forward to a state that is acceptable. Some steps have no true compensation at all, which is why they belong last in the sequence.",
    emFraming:
      "Design the compensations with the product owner, not just with engineers. 'Order placed then cancelled' is a different customer experience from 'order never placed', and the difference shows up in support tickets and in the accounts.",
    topicIds: [
      "transactions.compensating-actions",
      "transactions.sagas",
      "transactions.atomicity",
    ],
    tier: 1,
    speed: {
      question: "Why is a compensating action not a rollback?",
      correct:
        "The original step really happened and was visible — you move forward to an acceptable state",
      distractors: [
        "It runs asynchronously, so the undo may be delayed",
        "It only restores the affected rows, not the whole transaction",
        "It is applied by the coordinator rather than by the participant",
      ],
    },
  },
]
