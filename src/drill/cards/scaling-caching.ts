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
    speed: [
      {
        question:
          "Statelessness is the precondition for horizontal scaling because…",
        correct:
          "Any instance must be able to serve any request, so you can add and lose them freely",
        distractors: [
          "Stateless services use less memory, so more fit on each machine",
          "It removes the need for a load balancer to track connections",
          "It guarantees requests are processed in order across the fleet",
        ],
      },
    ],
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
    speed: [
      {
        question:
          "Which fix for in-memory sessions costs nothing extra to run?",
        correct: "Stateless signed tokens carried by the client",
        distractors: [
          "A shared Redis session store",
          "Sticky sessions pinned at the load balancer",
          "Replicating session state between app instances",
        ],
      },
    ],
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
    speed: [
      {
        question:
          "Why does latency explode near 100% utilisation rather than degrading linearly?",
        correct:
          "Queueing — waiting time scales roughly with 1/(1−ρ), so the knee is sharp",
        distractors: [
          "The CPU starts thermal throttling under sustained load",
          "Garbage collection pauses grow with memory pressure",
          "It does degrade linearly; the jump is an artefact of percentile measurement",
        ],
      },
    ],
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
    speed: [
      {
        question: "Which is a characteristic bug of cache-aside?",
        correct:
          "A thundering herd when a hot key expires and every request misses at once",
        distractors: [
          "Writes are lost if the cache fails before flushing to the database",
          "Reads block until the cache finishes populating",
          "The cache and database can never be inconsistent, by construction",
        ],
      },
      {
        question: "In cache-aside, what does the application do on a miss?",
        correct: "Read the database, write the value into the cache, return it",
        distractors: [
          "Write to the cache and let it populate the database asynchronously",
          "Block until a background job refreshes the entry",
          "Return empty and schedule a refresh for the next request",
        ],
      },
    ],
  },
  {
    id: "cdn-what-for",
    prompt: "When does a CDN buy you nothing?",
    answer:
      "When the traffic is mostly dynamic, per-user, and write-heavy. A CDN caches by URL at the edge; if almost every response is personalised or every request mutates state, there is nothing cacheable and you have added a hop and a bill. It earns its place with static assets, public read-heavy content, and requests with high repeat rates across users.",
    expands: "Content Delivery Network",
    emFraming:
      "Worth checking the actual cacheable fraction before adding one. 'Put a CDN in front of it' is a reflex that solves the viral-blog problem and does nothing at all for an internal CRUD app.",
    topicIds: ["caching.cdn", "caching.edge-caching", "cost.right-sizing"],
    tier: 2,
    speed: [
      {
        question: "When does a CDN buy you nothing?",
        correct: "When traffic is mostly dynamic, per-user and write-heavy",
        distractors: [
          "When your users are all in one country",
          "When the origin is already behind a load balancer",
          "When content changes more than once a day",
        ],
      },
    ],
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
    speed: [
      {
        question: "Why can adding app servers make database performance worse?",
        correct:
          "Each instance brings its own pool, so connections multiply without adding database capacity",
        distractors: [
          "More instances means more concurrent transactions and more deadlocks",
          "The database must replicate to more clients, increasing write load",
          "It cannot — adding stateless instances never affects the database",
        ],
      },
    ],
  },
]
