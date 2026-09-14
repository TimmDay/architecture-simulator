import type { Card } from "../types"

/**
 * Topics that simulator rules can raise but that had no card to enqueue.
 * A verdict pointing at a topic with no card closes no loop.
 */
export const gapCards: Card[] = [
  {
    id: "health-checks",
    prompt:
      "What is a load balancer health check actually doing, and what is the difference between a liveness and a readiness check?",
    answer:
      "Polling each instance and removing from rotation any that fail, so traffic stops going to something that cannot serve it. Liveness asks 'is this process wedged and in need of a restart' — it should test almost nothing, because a dependency being down is not a reason to kill your own process. Readiness asks 'can this instance serve a request right now', and it may legitimately fail while the instance warms up, drains connections before shutdown, or loses a dependency it genuinely cannot work without.",
    emFraming:
      "The classic outage: a readiness check that queries the database, the database blips, every instance simultaneously reports unready, and the load balancer removes the entire fleet. Health checks that depend on shared dependencies turn a partial failure into a total one.",
    topicIds: [
      "load-balancing.health-checks",
      "reliability.graceful-degradation",
    ],
    tier: 1,
  },
  {
    id: "lb-algorithms",
    prompt:
      "Round robin, least connections, and consistent hashing: when does each one win?",
    answer:
      "Round robin is fine when requests cost roughly the same and instances are identical — it needs no state and cannot get confused. Least connections wins when request cost varies widely, because it naturally avoids a box already stuck on slow work, which round robin will happily keep feeding. Consistent hashing routes the same key to the same instance, which matters when instances hold per-key state such as a local cache, and its virtue is that adding or removing an instance only remaps its share rather than reshuffling everything.",
    emFraming:
      "Least outstanding requests is the safest default for real services with mixed workloads. Round robin's weakness shows up exactly during an incident, when one instance is degraded but still accepting connections.",
    topicIds: [
      "load-balancing.algorithms",
      "load-balancing.l4-vs-l7",
      "partitioning.consistent-hashing",
    ],
    tier: 2,
  },
  {
    id: "consistent-hashing",
    prompt:
      "What problem does consistent hashing solve that `hash(key) % N` does not?",
    answer:
      "Rebalancing cost. With modulo, changing N remaps almost every key — add one cache node to nine and roughly 90% of keys move, so the entire cache misses at once. Consistent hashing places nodes and keys on a ring and assigns each key to the next node clockwise, so adding or removing a node only moves the keys in that node's arc: roughly 1/N of them. Virtual nodes (many ring positions per physical node) smooth out the uneven arcs that a small number of nodes would otherwise produce.",
    emFraming:
      "The failure it prevents is a cluster resize turning into a thundering herd on the origin. It is the standard answer for distributed caches and for shard assignment where the node count changes.",
    topicIds: [
      "partitioning.consistent-hashing",
      "partitioning.rebalancing",
      "caching.stampede",
    ],
    tier: 2,
  },
  {
    id: "event-driven-tradeoffs",
    prompt:
      "What does an event-driven architecture buy you, and what does it cost that a synchronous one does not?",
    answer:
      "It buys decoupling in time and in knowledge: the producer does not wait for consumers and does not need to know they exist, so consumers can be added, scaled, or be briefly down without affecting the write path. It costs you the straight line. There is no single place the whole operation is visible, failures surface far from their cause, ordering and duplicate delivery become your problem, and 'is it done yet' stops having an immediate answer — the system is now eventually consistent by construction, and debugging means correlating across services.",
    emFraming:
      "The honest test before adopting it: can you name more than one consumer, and does the producer genuinely not need the result? If the answer is one consumer and the producer waits anyway, a synchronous call is simpler and you should make it.",
    topicIds: [
      "styles.event-driven",
      "messaging.queue-vs-log",
      "observability.metrics-logs-traces",
    ],
    tier: 1,
  },
  {
    id: "encryption-at-rest",
    prompt:
      "What does encryption at rest actually protect against, and what does it not?",
    answer:
      "It protects against someone obtaining the physical or virtual storage: a decommissioned disk, a stolen backup, a snapshot copied to the wrong account, a misconfigured bucket. It does not protect against anything that goes through the running database, because the database decrypts transparently for anybody it authorises — so a compromised application, a stolen credential, or SQL injection reads perfectly clear data. It is close to free on managed services and it is one control among several, not a substitute for access management.",
    emFraming:
      "Worth being precise about in compliance conversations, because it is often presented as though it addresses breach risk generally. It changes a lost disk from a disclosure into a non-event, and changes nothing about a leaked credential.",
    topicIds: ["security.encryption-at-rest", "security.least-privilege"],
    tier: 1,
  },
  {
    id: "pii-and-residency",
    prompt:
      "What does data residency require beyond 'store it in the right region', and why is it harder than it sounds?",
    answer:
      "That the data does not leave the jurisdiction at all — which covers far more than the primary store. Backups and snapshots, read replicas, caches, search indexes, analytics warehouses, logs and traces containing field values, error reports, queue contents, and any third-party processor all hold copies. Access counts too: an engineer in another country querying the database is a transfer. So the requirement propagates to every derived copy in the system, and the ones that catch people out are logs and observability pipelines.",
    emFraming:
      "The practical approach is to keep an inventory of every place a record can land, and to minimise: the cheapest way to comply is to not collect the field, and the second cheapest is to tokenise it so the copies hold a reference rather than the value.",
    topicIds: [
      "security.pii-and-residency",
      "security.encryption-at-rest",
      "observability.metrics-logs-traces",
    ],
    tier: 1,
  },
  {
    id: "least-privilege",
    prompt:
      "What does least privilege mean concretely for a service, and what is the usual gap?",
    answer:
      "Each component gets exactly the permissions it needs and no more: a read-only service gets read-only database credentials; a worker that writes one table cannot drop another; an instance's role reaches only its own bucket prefix. The usual gap is that permissions are granted once during development, where broad access is convenient, and never narrowed — so every service runs as something close to an administrator and a single compromised component becomes total access. Credentials also need rotation and short lifetimes, since a permission that cannot be revoked quickly is not really scoped.",
    emFraming:
      "The question that exposes it: if this one service were compromised, what exactly could the attacker reach? If the answer is 'everything', the blast radius of every bug in it is the whole system.",
    topicIds: [
      "security.least-privilege",
      "security.zero-trust",
      "security.secrets",
    ],
    tier: 1,
  },
  {
    id: "team-topologies",
    prompt: "Why does team structure belong in an architecture review at all?",
    answer:
      "Because ownership boundaries and service boundaries converge whether you plan it or not. A service owned by three teams accumulates the interfaces of a committee and nobody is accountable for its coherence; a team owning nine services cannot maintain any of them well. The useful shape is stream-aligned teams owning a slice of the product end to end, with platform teams providing the paved road they build on — and cognitive load, not headcount, is the constraint that decides how much one team can actually own.",
    emFraming:
      "This is the half of the architecture an engineering manager directly controls. If you want a service boundary to hold, put one team on either side of it; if you want two services merged, merging the teams first usually does the work for you.",
    topicIds: [
      "org.team-topologies",
      "org.conways-law",
      "org.ownership-boundaries",
    ],
    tier: 1,
  },
]
