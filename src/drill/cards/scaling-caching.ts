import type { Card } from "../types"

export const scalingCachingCards: Card[] = [
  {
    id: "statelessness",
    prompt:
      "What does it mean for an app server to be stateless, and why is it the precondition for horizontal scaling?",
    answer:
      "No request depends on data held in that particular instance's memory -- session, uploaded file, in-progress work all live in shared storage or in the request itself. It is the precondition for horizontal scaling because any instance must be able to serve any request: only then can you put N behind a load balancer, add and remove them freely, and lose one without losing the work it held.",
    emFraming:
      "Statelessness is not free, it relocates state. The question to ask is where it went and what that thing's availability now is -- a shared session store on the critical path is a new single point of failure that the diagram makes look like a small box.",
    topicIds: ["scaling.statelessness", "scaling.vertical-vs-horizontal"],
    tier: 1,
  },
  {
    id: "session-affinity",
    prompt:
      "You put two app servers behind a load balancer and users start getting logged out randomly. What happened, and what are the fixes ranked by cost?",
    answer:
      "Sessions are held in each instance's memory. You log in on instance A; the next request is routed to instance B, which has never heard of your session. Fixes: (1) stateless signed tokens (JWT or similar) -- free, no new infrastructure; (2) a shared session store such as Redis -- costs money and adds a component on the critical path; (3) sticky sessions at the load balancer -- cheapest to implement but re-breaks on instance loss and unbalances traffic.",
    emFraming:
      "Note that option 2, the one teams reach for first, makes availability worse unless the store is itself redundant -- and a redundant one costs double. Option 3 is a trap: it works until the instance dies, at which point you have the original bug back, now only during incidents.",
    topicIds: ["scaling.session-affinity", "scaling.statelessness"],
    tier: 1,
  },
  {
    id: "utilization-latency",
    prompt:
      "Why does latency explode as a component approaches 100% utilization, rather than degrading linearly?",
    answer:
      "Queueing. Arrivals are not perfectly spaced, so a server at high utilization has no slack to absorb bursts, and waiting time scales roughly with 1/(1-rho). At 50% utilization the queue is short; at 90% waiting time is ~10x the service time; at 99% it is ~100x. The knee is sharp and it arrives well before you run out of capacity on paper.",
    emFraming:
      "This is why capacity targets are 60-70%, not 95%, and why 'we have headroom, we're only at 85%' is wrong. It is also why the fix for a latency problem is often more instances rather than faster code.",
    topicIds: [
      "fundamentals.percentiles",
      "fundamentals.littles-law",
      "scaling.autoscaling",
    ],
    tier: 1,
  },
  {
    id: "cache-aside",
    prompt: "Describe cache-aside, and name its two characteristic bugs.",
    answer:
      "The application checks the cache; on a miss it reads the database, writes the value into the cache, and returns it. Writes go to the database and invalidate the cache entry. Bug one: stale data, when an invalidation is missed or a concurrent reader repopulates the cache with a value it read before the write landed. Bug two: the thundering herd -- a hot key expires and every concurrent request misses simultaneously and hits the database at once.",
    emFraming:
      "Herd fixes are worth knowing by name: request coalescing (one caller fetches, the rest wait), probabilistic early expiry, or never expiring hot keys and invalidating explicitly. Also: a cache is not a durability strategy, and a system that cannot survive a cold cache will not survive a cache restart.",
    topicIds: [
      "caching.cache-aside",
      "caching.stampede",
      "caching.invalidation",
    ],
    tier: 1,
  },
  {
    id: "cdn-what-for",
    prompt: "When does a CDN buy you nothing?",
    answer:
      "When the traffic is mostly dynamic, per-user, and write-heavy. A CDN caches by URL at the edge; if almost every response is personalised or every request mutates state, there is nothing cacheable and you have added a hop and a bill. It earns its place with static assets, public read-heavy content, and requests with high repeat rates across users.",
    emFraming:
      "Worth checking the actual cacheable fraction before adding one. 'Put a CDN in front of it' is a reflex that solves the viral-blog problem and does nothing at all for an internal CRUD app.",
    topicIds: ["caching.cdn", "caching.edge-caching", "cost.right-sizing"],
    tier: 2,
  },
  {
    id: "connection-pooling",
    prompt:
      "Why does adding app servers sometimes make database performance worse?",
    answer:
      "Each app instance holds its own connection pool, so instances x pool size connections arrive at the database. Connections are not free -- each costs memory and a backend process in Postgres -- and past a few hundred the database spends its time context-switching rather than serving queries. Adding instances multiplies connections without adding database capacity.",
    emFraming:
      "The fix is an external pooler (PgBouncer and friends) so the database sees a bounded connection count regardless of fleet size. This is a genuinely counterintuitive result and a good one to have ready when someone proposes scaling out of a database problem.",
    topicIds: ["scaling.connection-pooling", "scaling.vertical-vs-horizontal"],
    tier: 2,
  },
]
