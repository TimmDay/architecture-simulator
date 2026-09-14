import type { Card } from "../types"

export const stylesAndStoresCards: Card[] = [
  {
    id: "monolith-vs-microservices",
    prompt:
      "When is a monolith the right answer, and what does a modular monolith get you that neither extreme does?",
    answer:
      "A monolith is right when one team owns the product, when the domain boundaries are still moving, and when you would rather debug a stack trace than a distributed trace — which covers most systems for most of their life. It gives you atomic transactions across the whole domain, one deploy, one place to look, and refactoring that a compiler can check. A modular monolith keeps all of that while enforcing internal boundaries: modules with explicit interfaces, no reaching into another module's tables, ideally checked by tooling. That buys you the option to extract a service later when a real reason appears — a scaling axis, a team boundary, a compliance edge — rather than guessing the boundaries up front when you know least.",
    emFraming:
      "Microservices solve an organisational problem before a technical one: independent deployability for independent teams. If you have one team, you are paying distributed-systems costs for a benefit you cannot collect. The honest question is not 'are microservices better' but 'how many teams need to ship without coordinating'.",
    topicIds: [
      "styles.monolith",
      "styles.modular-monolith",
      "styles.microservices",
      "org.conways-law",
    ],
    tier: 1,
    speed: [
      {
        question: "What problem do microservices primarily solve?",
        correct:
          "Independent deployability for independent teams — an organisational problem first",
        distractors: [
          "Scaling beyond what one process can handle",
          "Isolating failures so one bug cannot take everything down",
          "Allowing each component to use the best-suited language",
        ],
      },
      {
        question:
          "What does a modular monolith preserve that microservices give up?",
        correct:
          "Atomic transactions across the domain, and refactoring the compiler can check",
        distractors: [
          "The ability to scale components independently",
          "Deployment isolation between modules",
          "Separate failure domains per module",
        ],
      },
    ],
  },
  {
    id: "cqrs-event-sourcing",
    prompt: "What are CQRS and event sourcing, and what do they cost?",
    answer:
      "CQRS separates the write model from the read models: commands go to a model shaped for validating and recording changes, and queries are served by projections shaped for reading, updated asynchronously. Event sourcing goes further and makes the sequence of events the source of truth, with current state derived by replaying them — which gives you a perfect audit trail, the ability to rebuild any projection, and temporal queries. The costs are real: projections are eventually consistent so the UI must cope with a write not being visible yet, events are permanent so schema evolution means versioning them forever, and 'what is the current state' stops being a query anyone can write by hand.",
    emFraming:
      "Both are usually adopted for one aggregate with a genuine audit or temporal requirement — a ledger, an order lifecycle — rather than for a whole system. Applying event sourcing everywhere is how teams end up unable to answer simple questions about their own data.",
    topicIds: ["styles.cqrs-es", "consistency.eventual", "transactions.outbox"],
    tier: 2,
    speed: [
      {
        question: "What does CQRS separate?",
        correct:
          "The model used to record changes from the models used to answer queries",
        distractors: [
          "Reads and writes onto separate database replicas",
          "The API layer from the domain layer",
          "Synchronous commands from asynchronous events",
        ],
      },
      {
        question: "What is event sourcing's most underestimated cost?",
        correct:
          "Events are permanent, so schema evolution means versioning them forever",
        distractors: [
          "Storage, since nothing is ever deleted",
          "Replay time when rebuilding a projection",
          "The need for a specialised event store product",
        ],
      },
    ],
  },
  {
    id: "serverless-tradeoffs",
    prompt:
      "When does serverless genuinely win, and where does it stop making sense?",
    answer:
      "It wins for spiky, unpredictable or low-volume workloads — you pay per invocation, scale to zero, and skip capacity planning entirely, which is exactly right for a webhook handler, a nightly job, or a product with no traffic yet. It stops making sense as load becomes steady and high, because per-invocation pricing crosses over against reserved capacity, usually well before people expect. The other limits are structural: cold starts on the latency path, execution time caps, no long-lived connections, and connection-per-invocation pressure on a relational database that needs a proxy in front of it.",
    emFraming:
      "The cost crossover is worth actually calculating rather than assuming, and it moves with your latency requirements: provisioned concurrency to eliminate cold starts removes most of the pricing advantage, at which point you are paying serverless rates for server-shaped behaviour.",
    topicIds: [
      "styles.serverless",
      "cost.serverless-vs-reserved",
      "scaling.autoscaling",
    ],
    tier: 2,
    speed: [
      {
        question: "Where does serverless stop being cheaper?",
        correct:
          "As load becomes steady and high — per-invocation pricing crosses reserved capacity",
        distractors: [
          "Once you exceed a few hundred functions",
          "When functions need to call each other",
          "When the workload requires more than one region",
        ],
      },
      {
        question: "What breaks when serverless meets a relational database?",
        correct:
          "Connection count — each invocation wants its own, so you need a pooling proxy",
        distractors: [
          "Transactions cannot span a function invocation",
          "Cold starts prevent connection reuse entirely",
          "Functions cannot hold credentials securely",
        ],
      },
    ],
  },
  {
    id: "cell-based-architecture",
    prompt: "What is cell-based architecture, and what does it actually buy?",
    answer:
      "Running many complete, independent copies of the stack — cells — each serving a subset of users, with a thin routing layer mapping user to cell. What it buys is a bounded blast radius: a bad deploy, a poisoned cache, a hot tenant or a corrupted shard affects one cell's users rather than everyone, and you can deploy cell by cell and stop. It also gives you a natural unit of capacity planning and a natural place to put a noisy tenant. The costs are real: more infrastructure, cross-cell operations become genuinely hard, and the routing layer becomes a critical dependency that must itself be extremely simple and reliable.",
    emFraming:
      "This is the architectural answer to multi-tenancy problems that rate limiting alone cannot fix. Worth reaching for when a single tenant can plausibly damage every other tenant, which is usually the moment you sign your first enterprise customer.",
    topicIds: [
      "styles.cell-based",
      "reliability.bulkheads",
      "reliability.failure-domains",
    ],
    tier: 2,
    speed: [
      {
        question: "What does cell-based architecture primarily buy?",
        correct:
          "A bounded blast radius — a failure affects one cell's users, not everyone",
        distractors: [
          "Lower latency, by placing cells near users",
          "Cheaper infrastructure through better utilisation",
          "Simpler deployments, since cells are independent",
        ],
      },
      {
        question:
          "What becomes the critical dependency in a cell-based system?",
        correct: "The routing layer that maps a user to their cell",
        distractors: [
          "The shared database that spans cells",
          "The deployment pipeline that updates cells in order",
          "The monitoring system that aggregates across cells",
        ],
      },
    ],
  },
  {
    id: "rest-grpc-graphql",
    prompt: "REST, gRPC and GraphQL: what is each actually for?",
    answer:
      "REST is resource-oriented over HTTP with wide tooling, caching that works because GET is standard, and a low barrier for any client — the default for public APIs. gRPC is binary over HTTP/2 with generated clients from a schema, bidirectional streaming, and materially lower latency and payload size — the default for internal service-to-service traffic where both ends are yours and you want a contract enforced at compile time. GraphQL lets the client specify exactly what it needs in one request, which solves over-fetching and the mobile round-trip problem, at the cost of HTTP caching, easy rate limiting, and a server that must defend against expensive nested queries.",
    emFraming:
      "The pattern most large systems land on is gRPC internally, REST at the public edge, and GraphQL only where several clients have genuinely different data needs. Choosing GraphQL for a single first-party client usually buys complexity and no benefit.",
    topicIds: [
      "api.rest-grpc-graphql",
      "api.rest-design",
      "api.gateway-and-bff",
    ],
    tier: 1,
    speed: [
      {
        question: "What does GraphQL cost you?",
        correct:
          "HTTP caching and easy rate limiting, plus a server that must bound query cost",
        distractors: [
          "The ability to evolve the schema without versioning",
          "Strong typing between client and server",
          "Support for anything other than reads",
        ],
      },
      {
        question: "Why is gRPC the usual choice between internal services?",
        correct:
          "A schema-enforced contract, generated clients, and materially smaller, faster payloads",
        distractors: [
          "It works through any proxy without configuration",
          "It is easier to debug than JSON over HTTP",
          "It provides built-in retries and circuit breaking",
        ],
      },
    ],
  },
  {
    id: "leaderless-replication",
    prompt:
      "How does leaderless replication work, and what does read repair fix?",
    answer:
      "Every replica accepts writes; the client, or a coordinator on its behalf, writes to several and reads from several, using quorums to overlap the two. There is no leader to fail over, which removes a whole class of failure, but it also means replicas routinely disagree. Read repair fixes what it notices: when a read gets differing versions, the newest is written back to the stale replicas. Anti-entropy handles the rest in the background, usually with Merkle trees so two replicas can find which ranges differ without comparing everything. Concurrent writes to the same key still need resolution — last-write-wins, version vectors, or a CRDT.",
    emFraming:
      "The attraction is availability and operational simplicity: no failover, no promotion, no split-brain. The price is that 'the current value' genuinely has more than one answer for a while, and your application has to be one that can live with that.",
    topicIds: [
      "replication.leaderless",
      "consistency.quorum-rw",
      "consensus.crdts",
    ],
    tier: 2,
    speed: [
      {
        question: "What does read repair do?",
        correct:
          "Writes the newest version back to replicas found to be stale during a read",
        distractors: [
          "Retries a read that failed to reach a quorum",
          "Rebuilds a replica that has fallen too far behind",
          "Resolves concurrent writes using version vectors",
        ],
      },
      {
        question: "What does leaderless replication remove?",
        correct:
          "Failover — there is no leader to promote, and so no split-brain from promotion",
        distractors: [
          "The need for quorums on reads and writes",
          "The possibility of replicas disagreeing",
          "Conflicts between concurrent writes",
        ],
      },
    ],
  },
  {
    id: "causal-consistency",
    prompt: "What is causal consistency, and why is it a useful middle ground?",
    answer:
      "Operations that are causally related are seen in the same order by everyone, while concurrent operations may be seen in any order. Concretely: if you reply to a comment, nobody sees your reply before the comment it answers — but two unrelated comments can appear in different orders to different people, and nobody cares. It is a useful middle ground because it rules out the anomalies users actually notice while requiring no global coordination, so it can be achieved with version vectors or logical clocks and remains available during a partition, unlike linearizability.",
    emFraming:
      "Most products that say they need strong consistency actually need causal consistency plus read-your-writes. Being able to name that distinction is often what turns 'we need a globally consistent database' into a much cheaper and more available design.",
    topicIds: [
      "consistency.causal",
      "consistency.read-your-writes",
      "consensus.crdts",
    ],
    tier: 2,
    speed: [
      {
        question: "What does causal consistency guarantee?",
        correct:
          "Causally related operations appear in the same order to everyone; concurrent ones may not",
        distractors: [
          "Every read returns the most recently written value",
          "All operations appear in the same total order to everyone",
          "Each client sees its own writes, but others may not",
        ],
      },
      {
        question: "Why is it attractive compared with linearizability?",
        correct:
          "It rules out the anomalies users notice while staying available during a partition",
        distractors: [
          "It is simpler to implement on a single-leader database",
          "It removes the need for version vectors or logical clocks",
          "It gives stronger guarantees at lower latency",
        ],
      },
    ],
  },
  {
    id: "write-through-caching",
    prompt: "Write-through, write-behind and write-around: what is each for?",
    answer:
      "Write-through writes to the cache and the store together, so the cache is never stale and a read after a write always hits — at the cost of write latency, and of caching data nobody will read. Write-behind acknowledges after the cache write and flushes to the store asynchronously, which is much faster and risks losing writes if the cache dies before flushing, so it suits data you can afford to lose, like counters or session state. Write-around writes only to the store and lets the cache populate on read, which avoids polluting the cache with write-heavy data that is rarely read back.",
    emFraming:
      "Cache-aside remains the default because it keeps the cache out of the write path entirely and fails safe: a cache outage degrades latency rather than correctness. The others are worth the coupling only when their specific property is the one you need.",
    topicIds: [
      "caching.write-through",
      "caching.cache-aside",
      "caching.invalidation",
    ],
    tier: 2,
    speed: [
      {
        question: "What does write-behind caching risk?",
        correct:
          "Losing acknowledged writes if the cache dies before flushing to the store",
        distractors: [
          "Serving stale reads immediately after a write",
          "Doubling write latency on the critical path",
          "Filling the cache with data that is never read",
        ],
      },
      {
        question: "When is write-around the right choice?",
        correct:
          "When data is written often and read rarely, so caching it would waste the cache",
        distractors: [
          "When reads must never see stale data",
          "When write latency is the binding constraint",
          "When the cache and store are in different regions",
        ],
      },
    ],
  },
  {
    id: "denormalization",
    prompt: "When should you denormalise, and what do you take on by doing it?",
    answer:
      "When a read path that matters is dominated by joins or fanout you cannot afford, and the data is read far more often than it is written — a feed, a product page, a dashboard. You duplicate data into the shape the read wants, so the read becomes a single lookup. What you take on is the obligation to keep the copies in step: every write now has to update several places, which means either a transaction spanning them, or asynchronous propagation and a window of inconsistency, plus a way to detect and repair drift. You have traded a correctness problem the database used to solve for a performance win.",
    emFraming:
      "The honest framing is that normalisation makes writes correct and denormalisation makes reads fast, so the question is which one your system is actually limited by. Doing it prematurely is how teams end up with three places a customer's name is stored and no idea which is right.",
    topicIds: [
      "data-stores.denormalization",
      "consistency.eventual",
      "partitioning.cross-shard-queries",
    ],
    tier: 2,
    speed: [
      {
        question: "What do you take on when you denormalise?",
        correct:
          "Keeping duplicated copies in step, and detecting drift when they are not",
        distractors: [
          "Higher storage cost, which is usually the limiting factor",
          "The inability to run ad-hoc analytical queries",
          "Slower writes due to additional index maintenance",
        ],
      },
      {
        question:
          "Normalisation optimises for writes; denormalisation optimises for…",
        correct: "Reads",
        distractors: ["Storage", "Consistency", "Schema evolution"],
      },
    ],
  },
  {
    id: "graph-databases",
    prompt: "When is a graph database genuinely the right choice?",
    answer:
      "When the relationships are the data and the queries traverse them to arbitrary depth — shortest path, 'friends of friends who work at X', fraud rings, dependency chains, access control derived from nested groups. In a relational store each hop is another join, so a five-hop query becomes unmanageable; a graph store makes a hop a pointer traversal, so cost scales with the result rather than the table. What you give up is ecosystem, operational familiarity and easy analytics, which is why the usual answer for two or three hops on modest data is a recursive CTE in Postgres rather than a new database.",
    emFraming:
      "The test is whether the traversal depth is unbounded or unknown at query time. Bounded, shallow relationships are a relational problem wearing a graph costume, and adopting a graph database for them costs you a whole new operational discipline for no benefit.",
    topicIds: [
      "data-stores.graph",
      "data-stores.relational-vs-document",
      "partitioning.cross-shard-queries",
    ],
    tier: 3,
    speed: [
      {
        question: "What makes a workload genuinely graph-shaped?",
        correct:
          "Traversals of unbounded or unknown depth, where each hop would be another join",
        distractors: [
          "Data with many foreign key relationships",
          "Highly connected data that changes frequently",
          "Queries that need to aggregate across many tables",
        ],
      },
      {
        question: "What do you give up by adopting a graph database?",
        correct: "Ecosystem, operational familiarity, and easy analytics",
        distractors: [
          "The ability to enforce a schema",
          "Transactional guarantees across writes",
          "Support for queries that are not traversals",
        ],
      },
    ],
  },
  {
    id: "oauth-oidc-jwt",
    prompt:
      "Distinguish OAuth 2.0, OIDC and JWT. What is each one actually doing?",
    answer:
      "OAuth 2.0 is an authorisation framework: it lets a user grant an application limited access to a resource without handing over their password, and produces an access token. OIDC is a thin identity layer on top, adding an ID token that says who the user is — OAuth alone never tells you that, which is the confusion behind a lot of broken 'login with' implementations. JWT is just a token format: a signed, base64 JSON payload that any holder can read and any party with the key can verify without a database lookup. The trade with JWTs is revocation — self-contained means you cannot easily invalidate one before it expires, which is why access tokens are short-lived and paired with a refresh token that can be revoked.",
    emFraming:
      "Two things to check in review: that JWTs are verified with the expected algorithm and issuer rather than trusting the header, and that there is an actual answer to 'how do we log somebody out everywhere right now'. 'They expire in an hour' is an answer, but it should be a chosen one.",
    topicIds: [
      "security.oauth-oidc-jwt",
      "security.authn-vs-authz",
      "security.secrets",
    ],
    tier: 1,
    speed: [
      {
        question: "What does OAuth 2.0 on its own tell you about the user?",
        correct:
          "Nothing — it grants access to a resource; identity comes from OIDC on top",
        distractors: [
          "Their identity, which is the whole purpose of the flow",
          "Their identity, but only if scopes include profile access",
          "Their identity, encoded in the access token's claims",
        ],
      },
      {
        question: "What is the main trade of a self-contained JWT?",
        correct: "You cannot easily revoke one before it expires",
        distractors: [
          "It cannot carry custom claims about the user",
          "It must be re-issued for every service it is sent to",
          "Its contents are encrypted, so the client cannot read them",
        ],
      },
    ],
  },
  {
    id: "encryption-in-transit",
    prompt: "What does TLS actually protect, and what is mTLS for?",
    answer:
      "TLS gives you confidentiality, integrity and server authentication on the wire: nobody in the middle can read or alter the traffic, and the client has verified it is talking to the server it intended via a certificate chain. It says nothing about who the client is. mTLS adds that — the client presents a certificate too, so both ends are authenticated — which is why it is the usual basis for service-to-service identity inside a zero-trust network, and what a service mesh is largely providing when it terminates and originates TLS for you.",
    emFraming:
      "Where it goes wrong operationally is certificate expiry, which takes down everything at once and always at the worst moment. Automated rotation is not a nice-to-have; a manual renewal process is an outage with a date on it.",
    topicIds: [
      "security.encryption-in-transit",
      "security.zero-trust",
      "security.authn-vs-authz",
    ],
    tier: 2,
    speed: [
      {
        question: "What does ordinary TLS NOT tell the server?",
        correct: "Who the client is",
        distractors: [
          "Whether the traffic was altered in transit",
          "Whether anyone in the middle could read it",
          "Which cipher suite was negotiated",
        ],
      },
      {
        question: "What is the characteristic operational failure of TLS?",
        correct: "Certificate expiry, which takes everything down at once",
        distractors: [
          "Cipher suite negotiation failing with older clients",
          "The handshake adding latency to every request",
          "Private keys leaking through misconfigured logs",
        ],
      },
    ],
  },
  {
    id: "chaos-engineering",
    prompt:
      "What is chaos engineering actually for, and what has to be true before you start?",
    answer:
      "Discovering how the system behaves under failure by causing failure deliberately, in production, because that is the only environment where the real dependencies, real traffic and real configuration exist. It is an experiment, not vandalism: you form a hypothesis about steady state, inject one specific failure, and see whether the hypothesis holds. What has to be true first is that you can observe steady state well enough to tell, that you can stop the experiment immediately, and that the blast radius is bounded — which usually means starting in staging, then a single instance, then a cell.",
    emFraming:
      "The value is in what it reveals about assumptions nobody wrote down: the timeout that was never set, the retry with no jitter, the fallback that was never exercised. A team that has never killed a dependency on purpose does not know what happens when one dies, and will find out at 3am instead.",
    topicIds: [
      "reliability.chaos",
      "reliability.graceful-degradation",
      "observability.alerting-on-symptoms",
    ],
    tier: 2,
    speed: [
      {
        question: "What has to exist before running a chaos experiment?",
        correct:
          "A measurable steady state, a stop button, and a bounded blast radius",
        distractors: [
          "A full staging replica of production",
          "Automated rollback for every service involved",
          "Sign-off from every team that owns a dependency",
        ],
      },
      {
        question: "What does chaos engineering mostly reveal?",
        correct:
          "Assumptions nobody wrote down — missing timeouts, untested fallbacks, retries without jitter",
        distractors: [
          "Capacity limits under peak load",
          "Security weaknesses in service-to-service auth",
          "Performance regressions introduced by recent deploys",
        ],
      },
    ],
  },
  {
    id: "infrastructure-as-code",
    prompt: "What does infrastructure as code buy you beyond automation?",
    answer:
      "Reviewability and reproducibility. Infrastructure defined in version-controlled files can be diffed before it is applied, reviewed like any other change, rolled back to a known state, and recreated in another account or region from scratch — which is what makes disaster recovery a procedure rather than an archaeology project. It also removes the class of incident caused by drift: a console change nobody recorded, which works until the environment is rebuilt and nobody knows why the new one behaves differently.",
    emFraming:
      "The practice that makes it real is treating manual console changes as incidents rather than shortcuts. A codebase that describes 80% of the infrastructure with an undocumented 20% is arguably worse than none, because it creates confidence that is not warranted.",
    topicIds: [
      "delivery.iac",
      "delivery.rollback",
      "reliability.state-vs-compute",
    ],
    tier: 2,
    speed: [
      {
        question: "What is the underrated benefit of IaC?",
        correct:
          "Infrastructure changes become reviewable and diffable before they are applied",
        distractors: [
          "It provisions resources faster than a console",
          "It reduces cloud costs by preventing over-provisioning",
          "It allows the same config to target multiple providers",
        ],
      },
      {
        question: "Why is 80% coverage arguably worse than none?",
        correct:
          "It creates confidence that the code describes reality, when a hidden 20% does not",
        distractors: [
          "Partial state files corrupt on every apply",
          "Mixed management causes resources to be destroyed",
          "It prevents rollback of the managed portion",
        ],
      },
    ],
  },
  {
    id: "universal-scalability",
    prompt:
      "Why does adding machines eventually make a system slower rather than merely failing to help?",
    answer:
      "Because two costs grow with the node count. Contention — the serialised fraction of the work, which is Amdahl's law and caps your speedup. And coherence — the cost of nodes keeping each other consistent, which grows roughly with the square of the node count because every node may need to coordinate with every other. Contention flattens the curve; coherence bends it back down. That is the Universal Scalability Law, and it is why a system can get worse past some size, and why removing a shared lock or a chatty coordination protocol often does more than adding hardware.",
    emFraming:
      "The practical use is as a prompt: before approving more capacity, ask what is serialised and what has to coordinate. If the answer is 'everything talks to everything', more machines will make it worse, and no amount of budget fixes that.",
    topicIds: [
      "fundamentals.universal-scalability",
      "scaling.vertical-vs-horizontal",
      "consensus.coordination-services",
    ],
    tier: 3,
    speed: [
      {
        question: "What makes a system get SLOWER as nodes are added?",
        correct:
          "Coherence — the cost of nodes coordinating with each other, growing roughly quadratically",
        distractors: [
          "Contention on the serialised portion of the work",
          "Network latency between an increasing number of hops",
          "Scheduler overhead as the cluster grows",
        ],
      },
      {
        question: "What should you ask before approving more capacity?",
        correct: "What is serialised, and what has to coordinate with what",
        distractors: [
          "Whether the current instances are correctly sized",
          "Whether the load is evenly distributed",
          "Whether autoscaling thresholds are set correctly",
        ],
      },
    ],
  },
  {
    id: "anycast-and-dns",
    prompt:
      "How do users actually reach your nearest region, and what is DNS's role?",
    answer:
      "Two mechanisms. DNS-based routing returns a different IP depending on where the resolver is, which is simple and works everywhere but is coarse — it sees the resolver, not the user — and is slow to change because of TTL caching down a chain you do not control. Anycast advertises the same IP from many locations and lets BGP route each user to the topologically nearest one, which is fast, needs no client cooperation, and fails over in seconds rather than TTLs. Anycast is what CDNs and DNS providers themselves use; DNS routing is what most applications use because it needs no network ownership.",
    emFraming:
      "The operational consequence of TTLs is the one to internalise: a low TTL costs lookups and buys you the ability to move traffic quickly, and during an incident that difference is the difference between minutes and an hour. It is worth deciding before you need it.",
    topicIds: [
      "load-balancing.anycast-and-dns",
      "reliability.failure-domains",
      "caching.edge-caching",
    ],
    tier: 3,
    speed: [
      {
        question: "What is DNS-based geographic routing's main weakness?",
        correct:
          "It sees the resolver, not the user, and TTL caching makes changes slow",
        distractors: [
          "It requires clients to support EDNS extensions",
          "It cannot return more than one address per region",
          "It only works for HTTP traffic",
        ],
      },
      {
        question:
          "What does anycast use to get a user to the nearest location?",
        correct:
          "BGP routing to the topologically closest advertisement of the same IP",
        distractors: [
          "A geo-IP database consulted at the edge",
          "The client's configured DNS resolver location",
          "HTTP redirects issued by the first server reached",
        ],
      },
    ],
  },
]
