import type { Card } from "../types"

export const consistencyCards: Card[] = [
  {
    id: "cap-statement",
    prompt:
      "State CAP precisely. What is the choice actually between, and when does it apply?",
    answer:
      "In the presence of a network Partition, a distributed system must choose between Consistency (every read sees the latest write, i.e. linearizability) and Availability (every request to a non-failing node gets a non-error response). It is not a choice between three properties -- partition tolerance is not optional on a real network, so the only live choice is C or A, and only while a partition is happening.",
    emFraming:
      "The common failure in interviews and in design reviews is treating CAP as 'pick 2 of 3' and declaring a system 'AP'. Push back: ask which specific operation, on which data, during which partition. A system is almost never uniformly CP or AP -- a payment write and a profile-avatar read in the same product should make different choices.",
    topicIds: ["consistency.cap"],
    tier: 1,
    speed: {
      question: "CAP forces a choice between which two, and when?",
      correct:
        "Consistency or availability, but only while a partition is happening",
      distractors: [
        "Consistency, availability or partition tolerance — pick any two, always",
        "Latency or consistency, on every request",
        "Consistency or partition tolerance, once you have more than one node",
      ],
    },
  },
  {
    id: "pacelc",
    prompt:
      "What does PACELC add to CAP, and why is the addition the more useful half day to day?",
    answer:
      "PACELC: if there is a Partition, choose Availability or Consistency; Else (the normal case, no partition) choose Latency or Consistency. The else-branch is the more useful half because partitions are rare and the latency/consistency trade-off is paid on every single request -- synchronous replication costs you a round trip on every write, forever.",
    emFraming:
      "This is the frame that turns 'we're eventually consistent' from a shrug into a budget. Ask what staleness window the product can tolerate, in milliseconds, and hold the design to it.",
    topicIds: ["consistency.pacelc", "consistency.cap"],
    tier: 2,
    speed: {
      question:
        "What does the 'else' branch of PACELC say you trade when there is NO partition?",
      correct: "Latency against consistency, on every single request",
      distractors: [
        "Availability against consistency, same as CAP",
        "Durability against throughput",
        "Nothing — without a partition there is no trade to make",
      ],
    },
  },
  {
    id: "read-your-writes",
    prompt:
      "What is read-your-writes consistency, and what is the classic way to break it by accident?",
    answer:
      "A guarantee that after you write, your own subsequent reads see that write (other users may not yet). It is broken classically by adding read replicas and routing reads round-robin: you POST a comment to the primary, your next GET lands on a replica that is 200ms behind, and your comment appears to have vanished.",
    emFraming:
      "This is the single most common self-inflicted wound when a team first adds replicas to relieve a hot primary. Fixes: route a user's reads to the primary for a few seconds after they write, pin their session to the primary, or return the write's result optimistically. Know which one you chose and why.",
    topicIds: ["consistency.read-your-writes", "replication.lag"],
    tier: 1,
    speed: {
      question: "What most commonly breaks read-your-writes by accident?",
      correct:
        "Adding read replicas and routing a user's reads round-robin after they write",
      distractors: [
        "Using a cache with too short a TTL",
        "Running the database at a lower isolation level",
        "Serving reads and writes from the same primary",
      ],
    },
  },
  {
    id: "quorum-rw",
    prompt:
      "In a leaderless quorum system with N replicas, what condition on R and W gives strong consistency, and what does violating it buy you?",
    answer:
      "R + W > N guarantees the read set and write set overlap in at least one replica, so a read sees the latest acknowledged write. Violating it (R + W <= N) buys lower latency and higher availability -- you can serve reads and writes with fewer replicas responding -- at the cost of possibly reading stale data.",
    emFraming:
      "N=3, W=2, R=2 is the usual default and is worth being able to justify on the spot. Note that R + W > N alone does not give you linearizability in the presence of concurrent writes or failed writes -- it is a necessary condition, not a sufficient one.",
    topicIds: ["consistency.quorum-rw"],
    tier: 2,
    speed: {
      question:
        "In a leaderless system with N replicas, what condition makes a read see the latest acknowledged write?",
      correct: "R + W > N, so the read set and write set must overlap",
      distractors: [
        "R + W = N, so every replica is touched exactly once",
        "R > W, so reads always consult more nodes than writes did",
        "W > N/2, a majority on write is enough by itself",
      ],
    },
  },
  {
    id: "eventual-vs-strong-cost",
    prompt:
      "What does strong consistency actually cost, in concrete terms, versus eventual?",
    answer:
      "A coordination round trip on the critical path. Strong consistency requires agreement before acknowledging -- synchronous replication, consensus, or a single writer -- so every write pays at least one extra network hop, and cross-region that is 50-150ms. It also reduces availability: if the nodes you need cannot be reached, you must refuse the write.",
    emFraming:
      "When someone says 'let's just make it strongly consistent', the question is: which p99 are you willing to give up, and are you willing to return errors during a partition? If the answer to both is 'none', they have not made a choice yet.",
    topicIds: ["consistency.eventual", "consistency.linearizability"],
    tier: 2,
    speed: {
      question: "What does strong consistency cost on the happy path?",
      correct:
        "A coordination round trip on every write, before it can be acknowledged",
      distractors: [
        "Extra storage, because more versions of each row are retained",
        "Nothing until a partition happens — that is the whole point of PACELC",
        "More read capacity, since reads must check every replica",
      ],
    },
  },
  {
    id: "monotonic-reads",
    prompt:
      "What is monotonic reads, and what does its violation look like to a user?",
    answer:
      "A guarantee that if you have seen a value, you will never subsequently see an older one. Violated, a user refreshes a page and watches data travel backwards in time -- a comment thread that has 5 replies, then 3, then 5 again -- because successive reads hit replicas at different points in the replication stream.",
    emFraming:
      "Usually fixed by making a user's reads sticky to one replica. Worth raising in review whenever someone proposes round-robin reads across replicas with visible lag.",
    topicIds: ["consistency.monotonic-reads", "replication.lag"],
    tier: 3,
    speed: {
      question: "What does a violation of monotonic reads look like to a user?",
      correct:
        "Data travelling backwards — a thread shows 5 replies, then 3, then 5 again",
      distractors: [
        "Their own comment missing right after they posted it",
        "Two users seeing different values at the same moment",
        "A write succeeding and then being silently rolled back",
      ],
    },
  },
]
