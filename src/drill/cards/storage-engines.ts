import type { Card } from "../types"

export const storageEngineCards: Card[] = [
  {
    id: "lsm-vs-btree",
    prompt:
      "LSM tree versus B-tree: what is each good at, and why does it explain the choice between Cassandra and Postgres?",
    answer:
      "A B-tree updates pages in place, so a write is a seek and a page write, and reads are a handful of page reads down a shallow tree — excellent for reads and for range scans, and the write path is bounded by random I/O. An LSM tree appends to an in-memory table, flushes it as an immutable sorted file, and merges files in the background, so writes are sequential and fast, but a read may have to check several files and relies on Bloom filters and caching to stay quick. That is the trade: LSM buys write throughput and pays in read amplification and background compaction; B-tree buys predictable reads and pays in random write I/O. Cassandra and RocksDB are LSM; Postgres and MySQL are B-tree.",
    expands: "LSM: Log-Structured Merge-tree",
    emFraming:
      "The operational tail of LSM is compaction: it consumes I/O in the background and, if it falls behind, read latency degrades and disk use grows. A system that looks fine in a benchmark can behave very differently once compaction is competing with live traffic, which is why 'it does a million writes a second' needs the question 'for how long?'.",
    topicIds: [
      "data-stores.lsm-vs-btree",
      "data-stores.indexing",
      "data-stores.kv-and-wide-column",
    ],
    tier: 1,
    speed: [
      {
        question: "Why is an LSM tree fast at writes?",
        correct:
          "Writes go to memory and are flushed as sequential immutable files — no random page updates",
        distractors: [
          "It writes to several disks in parallel",
          "It defers durability until a batch fills up",
          "It keeps the whole index in memory permanently",
        ],
      },
      {
        question: "What does an LSM tree pay for its write speed?",
        correct:
          "Read amplification — a read may check several files — plus background compaction I/O",
        distractors: [
          "Weaker durability guarantees on acknowledged writes",
          "The inability to perform range scans",
          "Higher memory use per stored row",
        ],
      },
      {
        question: "Which engine does Postgres use?",
        correct: "B-tree",
        distractors: ["LSM tree", "Hash index only", "Columnar segments"],
      },
    ],
  },
  {
    id: "write-ahead-log",
    prompt:
      "What is a write-ahead log for, and what else ends up being built on it?",
    answer:
      "A write-ahead log (WAL) is an append-only file that records every change before it is applied to the actual data pages, and it is what a database's storage engine uses to survive a crash without losing acknowledged writes. It buys durability without paying for a random write on the critical path: the change is appended to a sequential log and fsynced before the transaction is acknowledged, so a crash can be recovered by replaying the log against the last checkpoint, even though the data pages themselves were only updated in memory. Having built it, you find it is also the natural basis for replication — followers stream and apply the same log — for point-in-time recovery, and for change data capture, which is how a database's writes reach a search index or a warehouse without anyone writing dual-write code.",
    emFraming:
      "This is why 'the database is the log' is a useful way to think. Once you see the WAL as an event stream that already exists, CDC stops looking like an integration hack and starts looking like reading something the database was producing anyway — which is a much safer pattern than having the application write to two places.",
    topicIds: [
      "data-stores.write-ahead-log",
      "replication.leader-follower",
      "transactions.outbox",
    ],
    tier: 1,
    speed: [
      {
        question: "What does a write-ahead log buy you?",
        correct:
          "Durability from one sequential fsync, instead of a random page write per change",
        distractors: [
          "The ability to roll back a committed transaction",
          "Consistency between concurrent transactions",
          "Compression of data pages before they reach disk",
        ],
      },
      {
        question: "Change data capture typically reads what?",
        correct:
          "The database's replication log — the same stream followers consume",
        distractors: [
          "A trigger-populated audit table",
          "Periodic snapshots diffed against the previous one",
          "The application's own event publications",
        ],
      },
    ],
  },
  {
    id: "bloom-filter",
    prompt: "What does a Bloom filter tell you, and where is it actually used?",
    answer:
      "Whether an item is definitely absent, or possibly present — false positives are possible, false negatives are not. It stores no items at all, just a bit array and k hash functions, so a few megabytes can cover millions of keys. That asymmetry is what makes it useful as a cheap guard in front of something expensive: an LSM engine checks one per file to avoid reading files that cannot contain the key, a CDN or cache uses one to avoid a lookup for content it has never seen, and a crawler uses one to skip URLs it has probably already fetched.",
    emFraming:
      "The design question it raises is what a false positive costs you. In front of a disk read it costs one wasted read, which is fine. In front of something irreversible — skipping a real user, refusing a legitimate action — it is not fine, and you need an exact structure however expensive.",
    topicIds: [
      "data-stores.bloom-filter",
      "caching.cache-aside",
      "data-stores.lsm-vs-btree",
    ],
    tier: 2,
    speed: [
      {
        question:
          "A Bloom filter says an item is present. What do you actually know?",
        correct: "Possibly present — you still have to check",
        distractors: [
          "Definitely present",
          "Definitely absent",
          "Present with a probability you can compute exactly for that item",
        ],
      },
      {
        question: "What is the design question a Bloom filter forces?",
        correct:
          "What a false positive costs — one wasted lookup is fine, an irreversible action is not",
        distractors: [
          "How many items you will store, since it cannot be resized",
          "Which hash function is cryptographically strongest",
          "Whether deletions will ever be required",
        ],
      },
    ],
  },
  {
    id: "inverted-index",
    prompt:
      "How does a search index actually find documents, and what does that cost?",
    answer:
      "An inverted index maps each term to the list of documents containing it, so a query for two words intersects two posting lists rather than scanning any documents. Building it means tokenising, normalising — lowercasing, stemming, removing stop words — and storing positions if you need phrase queries. The costs are that it is a derived structure that must be kept in sync with the source of truth, that it is expensive to update in place so most engines batch and merge segments, and that it is eventually consistent with the database by construction.",
    emFraming:
      "The architectural consequence is the important one: search is a second copy of your data with its own staleness and its own failure mode. Making it authoritative — or letting a write path wait on it — is how a search outage becomes a write outage. Treat it as derived, rebuild it from the source when it breaks, and let the write path publish asynchronously.",
    topicIds: [
      "data-stores.inverted-index",
      "consistency.eventual",
      "styles.event-driven",
    ],
    tier: 2,
    speed: [
      {
        question: "What does an inverted index map?",
        correct: "Each term to the list of documents containing it",
        distractors: [
          "Each document to the list of terms it contains",
          "Each query to its cached result set",
          "Each term to its frequency across the corpus",
        ],
      },
      {
        question: "What is the architectural risk of a search index?",
        correct:
          "It is derived state — making it authoritative turns a search outage into a write outage",
        distractors: [
          "It cannot be sharded, so it limits total corpus size",
          "It must be rebuilt from scratch on every schema change",
          "It only supports exact matches unless fuzzy search is enabled",
        ],
      },
    ],
  },
  {
    id: "geospatial-index",
    prompt:
      "How do you efficiently answer 'find everything within 5km of this point' across millions of records?",
    answer:
      "You reduce two dimensions to something indexable. Geohash encodes a lat/lng into a string where a shared prefix means physical proximity, so a range scan on a B-tree finds nearby points and you widen the prefix to widen the radius. A quadtree recursively subdivides space so dense regions get finer cells, which suits uneven distributions like cities. S2 maps the sphere onto a space-filling curve for the same reason with better behaviour at the poles and at cell boundaries. All of them are approximations: you retrieve a candidate set from neighbouring cells and then filter by true distance, because a cell boundary can put a very close point in a different cell.",
    emFraming:
      "Cell size is the tuning knob and it is a real trade: too coarse and you filter a huge candidate set, too fine and you scan many cells per query. For anything moving — drivers, deliveries — the write rate usually matters more than the read, which pushes you toward an in-memory structure rebuilt continuously rather than an index maintained transactionally.",
    topicIds: [
      "data-stores.geospatial-index",
      "data-stores.indexing",
      "designs.ride-hailing",
    ],
    tier: 2,
    speed: [
      {
        question: "What property makes geohash useful for proximity search?",
        correct:
          "Points that are physically close usually share a string prefix, so a range scan finds them",
        distractors: [
          "It encodes exact distance between any two hashes",
          "It guarantees every cell holds the same number of points",
          "It maps each point to a unique fixed-size integer",
        ],
      },
      {
        question: "Why must you filter results after a cell lookup?",
        correct:
          "Cells are approximations — a very close point can fall in a neighbouring cell",
        distractors: [
          "Because the index stores only a sample of the points",
          "Because geohashes collide for distant points",
          "Because the index is eventually consistent with the database",
        ],
      },
    ],
  },
  {
    id: "unique-ids",
    prompt:
      "Why does an auto-incrementing primary key break once you shard, and what replaces it?",
    answer:
      "Because the counter lives in one place. Sharded, either every shard issues the same ids or they all serialise on one allocator, which becomes the bottleneck and the single point of failure you sharded to avoid. Replacements: random UUIDv4, which is trivially distributed but destroys index locality because inserts land all over the B-tree; Snowflake-style ids, which pack a timestamp with a machine id and a per-millisecond sequence into 64 bits so they are sortable by time, compact and generated locally; and UUIDv7, which is the same idea in the UUID format. Sortability matters more than people expect — time-ordered keys keep inserts at the end of the index and make range queries by time free.",
    expands: "UUID: Universally Unique Identifier — v4 is the random variant",
    emFraming:
      "Snowflake's weakness is clock dependence: an id contains a timestamp, so a clock moving backwards can produce duplicates, and implementations have to detect it and refuse to issue rather than carry on. Worth asking about whenever someone proposes rolling their own.",
    topicIds: [
      "data-stores.unique-ids",
      "partitioning.strategies",
      "data-stores.indexing",
    ],
    tier: 1,
    speed: [
      {
        question: "Why is UUIDv4 a poor primary key for a large table?",
        correct:
          "It is random, so inserts scatter across the index instead of appending at the end",
        distractors: [
          "It is too long to store efficiently",
          "Collisions become likely past a few billion rows",
          "It cannot be generated without coordination",
        ],
      },
      {
        question: "What does a Snowflake id pack into 64 bits?",
        correct:
          "A timestamp, a machine id, and a per-millisecond sequence number",
        distractors: [
          "A hash of the row contents plus a shard id",
          "A monotonic counter plus a checksum",
          "A random value plus the creating service's name",
        ],
      },
      {
        question: "What is Snowflake's characteristic failure mode?",
        correct: "A clock moving backwards, which can produce duplicate ids",
        distractors: [
          "Running out of sequence space within a millisecond",
          "Machine ids colliding after a redeploy",
          "Ids becoming non-monotonic across shards",
        ],
      },
    ],
  },
  {
    id: "columnar-storage",
    prompt:
      "Why is a columnar store fast for analytics and bad at serving a request?",
    answer:
      "It stores each column contiguously rather than each row, so a query touching three columns of a hundred reads only those three, and because a column holds values of one type with low variety it compresses extremely well and can be scanned with vectorised operations. That is ideal for aggregating millions of rows. It is bad at serving a request because fetching one whole row means touching every column file, and writing one row means writing to all of them — so point lookups and small updates, which is what an application does constantly, are the worst case.",
    emFraming:
      "This is the mechanical reason behind OLTP/OLAP separation, and the reason 'just run the report against the replica' stops working. It also explains why the fix is usually not a faster query but a different store fed by CDC.",
    topicIds: [
      "data-stores.columnar",
      "data-stores.relational-vs-document",
      "designs.metrics-system",
    ],
    tier: 2,
    speed: [
      {
        question: "Why does columnar storage compress so well?",
        correct:
          "A column holds values of one type with low variety, so runs and dictionaries are effective",
        distractors: [
          "Rows are deduplicated before being written",
          "It stores only deltas from the previous row",
          "Compression is applied to the whole table as one block",
        ],
      },
      {
        question: "What is a columnar store's worst case?",
        correct: "Fetching or updating a single complete row",
        distractors: [
          "Aggregating one column across millions of rows",
          "Scanning a date range across a few columns",
          "Appending a large batch of new rows",
        ],
      },
    ],
  },
]
