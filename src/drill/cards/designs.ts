import type { Card } from "../types"

/**
 * The classic interview questions, framed around what each one actually hinges
 * on. Interviewers are not checking whether you can draw boxes -- they are
 * checking whether you find the one constraint the design turns on, and can say
 * why the obvious approach fails.
 */
export const designCards: Card[] = [
  {
    id: "design-url-shortener",
    prompt: "Design a URL shortener. What does it actually hinge on?",
    answer:
      "It is a read-heavy key-value lookup with a hard uniqueness constraint, and almost everything follows from the ratio: reads outnumber writes by a hundred to one or more, so the redirect path should barely touch the database — a cache in front, and permanent redirects the browser itself will remember. Generating the code is the interesting half: hashing the URL gives you collisions to resolve, so most designs pre-generate a keyspace or use a counter encoded in base62, which turns the problem into distributed unique id generation. Custom aliases add a genuine uniqueness constraint, which is the one thing you cannot make eventually consistent. Analytics on redirects should be fire-and-forget, never on the redirect's critical path.",
    emFraming:
      "The trap is spending the hour on the hash function. The interesting parts are the read/write asymmetry, what happens to the counter when you shard it, and whether an expired or deleted link must be immediately gone everywhere — which is a cache invalidation question dressed up as a product one.",
    topicIds: [
      "designs.url-shortener",
      "data-stores.unique-ids",
      "caching.cache-aside",
    ],
    tier: 2,
    speed: [
      {
        question: "What dominates a URL shortener's design?",
        correct:
          "A read/write ratio of 100:1 or more, so the redirect path should barely touch the database",
        distractors: [
          "The cost of storing billions of long URLs",
          "Generating cryptographically unguessable codes",
          "Handling redirect loops between shortened links",
        ],
      },
      {
        question:
          "Which part of a URL shortener cannot be made eventually consistent?",
        correct: "Uniqueness of a custom alias",
        distractors: [
          "The redirect lookup itself",
          "Click analytics",
          "Link expiry",
        ],
      },
    ],
  },
  {
    id: "design-rate-limiter",
    prompt: "Design a distributed rate limiter. What is the hard part?",
    answer:
      "Shared state on the hot path. Limiting per client means a counter every request must read and update, so the limiter becomes a dependency in front of everything — which makes its latency your latency and its failure your failure. The usual shape is token bucket in Redis with atomic increment-and-expire, sharded by client key so no single counter is hot. The real decisions are what happens when Redis is unreachable (fail open and risk overload, or fail closed and cause an outage — almost always fail open), and whether you tolerate approximation: local per-instance counters are much cheaper and let a client exceed the limit by roughly the instance count, which is usually fine.",
    emFraming:
      "Always include the limit, remaining and reset values in response headers. A limiter clients cannot see turns into blind retries, which is the exact traffic the limiter was installed to stop.",
    topicIds: [
      "designs.rate-limiter",
      "security.rate-limiting",
      "reliability.graceful-degradation",
    ],
    tier: 2,
    speed: [
      {
        question:
          "Your rate limiter's Redis is unreachable. What should it usually do?",
        correct:
          "Fail open — a limiter outage should not become a service outage",
        distractors: [
          "Fail closed, to protect the backend from overload",
          "Queue requests until Redis recovers",
          "Fall back to a global limit shared by all clients",
        ],
      },
      {
        question: "What does per-instance local counting cost you?",
        correct:
          "A client can exceed the limit by roughly the number of instances",
        distractors: [
          "Limits can no longer be configured per client",
          "Counters drift and eventually stop resetting",
          "It only works for a single region",
        ],
      },
    ],
  },
  {
    id: "design-news-feed",
    prompt: "Design a news feed. What is the central decision?",
    answer:
      "Whether the feed is assembled when someone writes or when someone reads. Fanout-on-write precomputes each follower's feed, so reads are a single cheap lookup and writes are O(followers) — which collapses when one account has fifty million of them. Fanout-on-read assembles at request time from the accounts you follow, so writes are trivial and reads are expensive, especially for people following thousands. Real systems do both: write-fanout for ordinary accounts, read-fanout for the handful of celebrities, merged at read time. Ranking then sits on top, and the moment it stops being chronological you need the candidate set, the features and the model serving to all fit inside the latency budget.",
    emFraming:
      "Being able to say 'hybrid, and here is where the boundary sits' is the senior answer, because it shows you noticed the distribution is not uniform. The follow-up is usually what the threshold is and who maintains it.",
    topicIds: [
      "designs.news-feed",
      "messaging.fanout",
      "partitioning.hot-keys",
    ],
    tier: 2,
    speed: [
      {
        question: "Where does fanout-on-write break?",
        correct:
          "Celebrity accounts — one post becomes millions of feed writes",
        distractors: [
          "Users who follow thousands of accounts",
          "Feeds that must be ranked rather than chronological",
          "Accounts that post many times per minute",
        ],
      },
      {
        question: "What does a real feed system actually do?",
        correct:
          "Both — write-fanout for ordinary accounts, read-fanout for celebrities, merged at read time",
        distractors: [
          "Fanout-on-write, with celebrity posts rate-limited",
          "Fanout-on-read, with aggressive caching per follower",
          "Fanout-on-write into a queue drained at the reader's pace",
        ],
      },
    ],
  },
  {
    id: "design-chat",
    prompt: "Design a chat system. What is hard about it?",
    answer:
      "Connection state and ordering. Every online user holds a long-lived connection, which is stateful and pins them to an instance, so you need a registry mapping user to instance and a way to deliver a message to whichever box holds the recipient. Messages need a per-conversation order that everybody agrees on, which is usually a sequence assigned by the conversation's owning shard rather than client timestamps, because clocks disagree. Delivery has to survive the recipient being offline, so messages are persisted first and pushed second, and the client syncs from its last-seen sequence on reconnect. Group chat turns one send into N deliveries, which is fanout again.",
    emFraming:
      "Read receipts and typing indicators look trivial and are often the highest-volume traffic in the system, several times the message rate. Worth saying out loud, because it changes the capacity numbers and is where a candidate usually forgets to look.",
    topicIds: [
      "designs.chat",
      "realtime.connection-scaling",
      "messaging.ordering",
    ],
    tier: 2,
    speed: [
      {
        question: "What orders messages in a conversation?",
        correct:
          "A sequence assigned by the conversation's owning shard — client clocks disagree",
        distractors: [
          "The timestamp set by the sending client",
          "The order the server happened to receive them",
          "A vector clock carried by each participant",
        ],
      },
      {
        question: "Which chat traffic is usually the highest volume?",
        correct:
          "Typing indicators and read receipts, often several times the message rate",
        distractors: [
          "Message delivery itself",
          "Media uploads and thumbnails",
          "Presence subscriptions for the contact list",
        ],
      },
    ],
  },
  {
    id: "design-notifications",
    prompt:
      "Design a notification system that sends email, push and SMS. What matters?",
    answer:
      "It is a fanout pipeline with unreliable third parties at the end, so the shape is a queue per channel, workers per channel, and each provider behind its own retry policy and circuit breaker — APNs being slow must not stop email. Deduplication matters because the same event can arrive twice and nobody forgives a duplicate push at 3am, so every notification carries an idempotency key. User preferences, quiet hours and rate caps per user are a filtering stage before the queue, not an afterthought. And delivery is at-least-once at best, with the provider's own acceptance being the only receipt you get.",
    expands: "SMS: Short Message Service",
    emFraming:
      "The part that bites in production is per-user rate limiting: a bug that triggers a million notifications is not stopped by your infrastructure limits, which are sized for a million notifications. A per-user cap is the thing that keeps a loop from becoming a public incident.",
    topicIds: [
      "designs.notifications",
      "messaging.fanout",
      "reliability.circuit-breaker",
    ],
    tier: 2,
    speed: [
      {
        question: "Why one queue per channel rather than one shared queue?",
        correct: "A slow or failing provider must not block the other channels",
        distractors: [
          "Different channels need different message formats",
          "It allows per-channel ordering guarantees",
          "Shared queues cannot be sharded by user",
        ],
      },
      {
        question:
          "What stops a bug from sending a million notifications to one user?",
        correct:
          "A per-user rate cap — infrastructure limits are sized for a million notifications",
        distractors: [
          "The provider's own throttling",
          "Deduplication by idempotency key",
          "Backpressure from the queue",
        ],
      },
    ],
  },
  {
    id: "design-web-crawler",
    prompt: "Design a web crawler. What are the real constraints?",
    answer:
      "Politeness and deduplication, not raw throughput. You must not hammer one host, so the frontier is partitioned by domain with a per-domain delay, which means the queue is really a set of per-host queues with schedulers in front. Deduplication happens at two levels — URL normalisation before fetching, and content hashing after, because the same page is reachable by many URLs. The frontier is enormous, so it lives on disk with a Bloom filter in front to answer 'have I seen this' cheaply. Prioritisation matters because you can never crawl everything: freshness and importance decide what gets revisited. And traps — infinite calendars, session ids in URLs — need depth and pattern limits or the crawler never leaves.",
    emFraming:
      "Respecting robots.txt and per-host rate limits is not politeness in the social sense, it is what stops you being blocked and what keeps the crawl legal in some jurisdictions. It also happens to be the constraint that shapes the whole architecture.",
    topicIds: [
      "designs.web-crawler",
      "data-stores.bloom-filter",
      "messaging.backpressure",
    ],
    tier: 2,
    speed: [
      {
        question: "What shapes a crawler's architecture more than throughput?",
        correct:
          "Politeness — per-host rate limits mean the frontier partitions by domain",
        distractors: [
          "Bandwidth cost of downloading pages",
          "Parsing malformed HTML reliably",
          "Storing the full text of every page crawled",
        ],
      },
      {
        question: "Why deduplicate content as well as URLs?",
        correct:
          "The same page is reachable by many URLs, so identical content arrives repeatedly",
        distractors: [
          "URLs change more often than content does",
          "Content hashing is cheaper than URL normalisation",
          "It detects pages that have been modified since last crawl",
        ],
      },
    ],
  },
  {
    id: "design-autocomplete",
    prompt: "Design search autocomplete. Why is it harder than it looks?",
    answer:
      "The latency budget is tens of milliseconds and a request fires on nearly every keystroke, so the query rate is several times your search rate and nothing on the path can touch a database. Suggestions are precomputed: a trie or finite-state structure with the top-k completions stored at each node, built offline from query logs and served from memory, usually at the edge. Updates are batched rather than live, because rebuilding is cheap relative to serving and freshness of minutes is fine. Personalisation and trending terms fight with cacheability, which is the real design tension — the more the answer depends on who is asking, the less you can cache it.",
    emFraming:
      "Client-side debouncing is part of the system design, not a frontend detail: firing on every keystroke rather than on a pause multiplies your traffic several times over for no benefit to the user.",
    topicIds: [
      "designs.autocomplete",
      "caching.edge-caching",
      "data-stores.inverted-index",
    ],
    tier: 2,
    speed: [
      {
        question: "Why can autocomplete not query the search index directly?",
        correct:
          "It fires on nearly every keystroke within a tens-of-milliseconds budget",
        distractors: [
          "Search indexes cannot do prefix matching",
          "The index is eventually consistent with the query logs",
          "Ranking requires the full query, not a prefix",
        ],
      },
      {
        question: "What is the central tension in autocomplete?",
        correct: "Personalisation and trending fight with cacheability",
        distractors: [
          "Index size against memory available at the edge",
          "Freshness against the cost of rebuilding the trie",
          "Prefix matching against typo tolerance",
        ],
      },
    ],
  },
  {
    id: "design-video-streaming",
    prompt: "Design video streaming. Where does the complexity actually live?",
    answer:
      "In the pipeline before anyone watches, and in the edge. Upload triggers transcoding into several resolutions and bitrates, chunked into segments of a few seconds with a manifest listing them — that is an expensive, parallelisable batch job, which is why it is a queue and a worker fleet rather than anything synchronous. Playback is then ordinary HTTP: the client fetches segments and adaptive bitrate logic picks the next rendition from measured throughput, so the player does the hard part. Delivery is overwhelmingly CDN, because the origin could never serve it and the content is perfectly cacheable. Live changes everything, because the pipeline now has a latency budget and segments are produced as they are watched.",
    emFraming:
      "The cost conversation is storage and egress, not compute: every title is stored several times over in different renditions, and egress at scale dwarfs everything else. That is why per-title encoding — spending more compute to cut bitrate — pays for itself.",
    topicIds: ["designs.video-streaming", "caching.cdn", "cost.egress"],
    tier: 2,
    speed: [
      {
        question: "Who decides which video quality to play?",
        correct:
          "The client — it measures throughput and picks the next segment's rendition",
        distractors: [
          "The CDN, based on the edge's available bandwidth",
          "The origin, based on the user's subscription tier",
          "The transcoder, which picks one rendition per device type",
        ],
      },
      {
        question: "What dominates streaming costs at scale?",
        correct: "Storage of many renditions, and egress",
        distractors: [
          "Transcoding compute",
          "Database capacity for the catalogue",
          "DRM licence issuance",
        ],
      },
    ],
  },
  {
    id: "design-ride-hailing",
    prompt: "Design ride hailing. What is the core problem?",
    answer:
      "Matching over a stream of moving locations. Drivers send positions every few seconds, which is an enormous write rate of data that is worthless within a minute, so it belongs in an in-memory geospatial index rather than a durable store — quadtree or S2 cells, rebuilt continuously. Matching queries the cells around the rider, ranks candidates, and must then handle the fact that several riders may be matched to one driver concurrently, which is a distributed locking or optimistic-concurrency problem on the driver. Once matched, the trip is authoritative state that needs durability and exactly the consistency the location stream does not. Surge pricing is a separate aggregation over supply and demand per cell.",
    emFraming:
      "The split worth naming is that ephemeral location data and durable trip data have opposite requirements and belong in different systems. Designs that put both in the same database are the ones that fall over, usually at exactly the moment the city gets busy.",
    topicIds: [
      "designs.ride-hailing",
      "data-stores.geospatial-index",
      "reliability.state-vs-compute",
    ],
    tier: 2,
    speed: [
      {
        question: "Where do driver location updates belong?",
        correct:
          "An in-memory geospatial index — the data is worthless within a minute",
        distractors: [
          "The primary transactional database, for consistency with trips",
          "A time-series database, for historical analysis",
          "An append-only log, replayed to rebuild state",
        ],
      },
      {
        question: "What concurrency problem does matching create?",
        correct:
          "Several riders can be matched to one driver at once, so the driver needs locking or optimistic concurrency",
        distractors: [
          "Location updates arriving out of order",
          "Surge prices changing mid-request",
          "Trips being written before the match is confirmed",
        ],
      },
    ],
  },
  {
    id: "design-payments",
    prompt:
      "Design a payment system. What separates a good answer from a bad one?",
    answer:
      "Treating money as something that must never be wrong rather than something that must be fast. Every operation carries a client-generated idempotency key, because a timeout tells you nothing and a retry must not double-charge. State lives in a ledger of immutable double-entry records rather than a mutable balance column, so the balance is derived and every change is auditable. The payment provider is a slow third party, so the request accepts and enqueues rather than waiting, and confirmation arrives asynchronously — which means webhooks, which are themselves at-least-once and must be verified and deduplicated. Reconciliation against the provider is a scheduled job, not an optimisation, because the two systems will disagree.",
    expands: "PCI DSS: Payment Card Industry Data Security Standard",
    emFraming:
      "The answer that lands is 'I would rather be slow and correct', said explicitly. Also worth saying: never store card details — let the provider tokenise, so the data you would have to protect never reaches you, and PCI scope shrinks to almost nothing.",
    topicIds: [
      "designs.payments",
      "transactions.idempotency",
      "transactions.compensating-actions",
    ],
    tier: 1,
    speed: [
      {
        question: "How should a balance be represented?",
        correct:
          "Derived from an immutable double-entry ledger, not stored as a mutable column",
        distractors: [
          "A mutable column updated inside a serializable transaction",
          "A cached aggregate recomputed nightly",
          "A CRDT counter that converges across regions",
        ],
      },
      {
        question:
          "Why is reconciliation against the provider a scheduled job rather than an optimisation?",
        correct:
          "The two systems will disagree, and you need to find out before a customer does",
        distractors: [
          "Providers require it under their terms of service",
          "It is the only way to detect duplicate charges",
          "Webhooks are unreliable, so it replaces them",
        ],
      },
      {
        question: "What is the simplest way to shrink PCI scope?",
        correct: "Never hold card details — let the provider tokenise them",
        distractors: [
          "Encrypt card numbers at rest with a managed key",
          "Store only the last four digits and the expiry",
          "Keep card data in a separate database with restricted access",
        ],
      },
    ],
  },
  {
    id: "design-metrics-system",
    prompt: "Design a metrics and monitoring system. What is the shape?",
    answer:
      "An enormous, relentless write rate of small timestamped numbers, read far less often but in large ranges — which is exactly what a time-series database is for, and exactly what a general-purpose database is bad at. Writes are appended and batched; storage is columnar and heavily compressed because consecutive values in a series are similar; and old data is downsampled rather than kept at full resolution, because nobody queries per-second data from last year. Cardinality is the thing that kills it: every distinct label combination is its own series, so one unbounded label turns thousands of series into millions. Alerting is a separate evaluation loop over recent data, not a query path users share.",
    emFraming:
      "Pull versus push is the recurring argument. Pull gives you liveness for free — a target that stops responding is obviously down — and makes discovery explicit; push handles short-lived jobs and networks you cannot reach into. Most large deployments end up with both and a gateway between them.",
    topicIds: [
      "designs.metrics-system",
      "data-stores.timeseries",
      "observability.cardinality",
    ],
    tier: 2,
    speed: [
      {
        question: "What kills a metrics system?",
        correct:
          "Cardinality — one unbounded label turns thousands of series into millions",
        distractors: [
          "Query volume from dashboards",
          "Retention of raw data beyond a year",
          "The number of distinct metric names",
        ],
      },
      {
        question: "Why is old metric data downsampled rather than deleted?",
        correct:
          "Long-range queries still need trends, just not per-second resolution",
        distractors: [
          "Regulators require a minimum retention period",
          "Deleting from a time-series store is expensive",
          "Downsampled data is used to train anomaly detection",
        ],
      },
    ],
  },
  {
    id: "design-object-storage",
    prompt: "Design an object store like S3. What are the interesting parts?",
    answer:
      "Durability and the metadata layer. Objects are split into chunks, erasure-coded rather than replicated whole — which gives the same durability for roughly half the storage — and spread across failure domains, with background scrubbing to detect and repair silent corruption. The metadata service is the harder half: it maps keys to chunk locations, must be strongly consistent for a key's latest version, and is where the system's scaling limits actually live, since it handles every operation while the data path is embarrassingly parallel. Large uploads are multipart so a failure does not restart the whole thing, and listing is deliberately limited because the flat keyspace has no real directories.",
    emFraming:
      "The lesson that transfers is separating the metadata plane from the data plane: one is small, consistent and hard, the other is enormous, parallel and simple. Most storage systems that scale have made exactly that split, and most that do not have failed to.",
    topicIds: [
      "designs.object-storage",
      "reliability.redundancy",
      "consistency.linearizability",
    ],
    tier: 3,
    speed: [
      {
        question: "Why erasure coding rather than full replication?",
        correct: "It gives comparable durability for roughly half the storage",
        distractors: [
          "It makes reads faster by parallelising across chunks",
          "It allows objects to be modified in place",
          "Replication cannot span availability zones",
        ],
      },
      {
        question: "Where do an object store's scaling limits actually live?",
        correct:
          "The metadata service — the data path parallelises, the key mapping does not",
        distractors: [
          "Network bandwidth out of each storage node",
          "The durability of individual disks",
          "The rate at which chunks can be erasure-coded",
        ],
      },
    ],
  },
]
