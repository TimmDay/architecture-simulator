import type { Card } from "../types"

export const transactionCards: Card[] = [
  {
    id: "atomicity-guarantee",
    prompt:
      "What does a database transaction actually guarantee about atomicity, and what does it not?",
    answer:
      "That the statements inside it either all take effect or none do — there is no state in which half of them are visible to anyone else, and a crash mid-transaction leaves nothing behind. What it does not guarantee is anything outside the database: an email sent, a message published, or a call to another service inside the transaction has already happened and will not be undone by a rollback. Atomicity is a property of that one database's state, not of your business operation.",
    emFraming:
      "This is the gap that the transactional outbox pattern exists to close. When someone says 'it's in a transaction, so it's safe', the question is which side effects are inside the database and which are not.",
    topicIds: [
      "transactions.atomicity",
      "transactions.acid",
      "transactions.outbox",
    ],
    tier: 1,
    speed: [
      {
        question: "What does a transaction's atomicity NOT cover?",
        correct:
          "Side effects outside the database — an email sent or an API called inside it are not undone",
        distractors: [
          "Changes made by other transactions running concurrently",
          "Writes to tables the transaction did not explicitly lock",
          "Statements that failed and were caught by the application",
        ],
      },
    ],
  },
  {
    id: "read-uncommitted",
    prompt: "What exactly does Read Uncommitted allow?",
    answer:
      "Dirty reads: your transaction can see rows written by another transaction that has not committed and may yet roll back. You can therefore make a decision based on a value that never existed. It permits every other anomaly too — non-repeatable reads, phantoms, lost updates — and buys almost nothing in return on modern engines. Postgres does not implement it at all; asking for it silently gives you Read Committed.",
    emFraming:
      "Effectively never the right answer. If it appears in a codebase, it is almost always cargo-culted from an attempt to avoid lock contention that MVCC had already solved.",
    topicIds: ["transactions.isolation-levels"],
    tier: 2,
    speed: [
      {
        question:
          "What does Read Uncommitted allow that Read Committed does not?",
        correct:
          "Dirty reads — seeing rows from a transaction that has not committed and may roll back",
        distractors: [
          "Non-repeatable reads within the same transaction",
          "Phantom rows appearing between two identical queries",
          "Lost updates from concurrent read-modify-write sequences",
        ],
      },
    ],
  },
  {
    id: "read-committed",
    prompt:
      "What does Read Committed guarantee, and what can still go wrong under it? It is the default in Postgres and most engines.",
    answer:
      "Every statement sees only data committed before that statement began, so dirty reads are impossible. What it does not give you is stability across statements: two identical SELECTs in the same transaction can return different rows, because another transaction committed in between. That is a non-repeatable read, and phantoms and lost updates are both still possible.",
    emFraming:
      "Being the default makes this the level most production bugs actually happen at. The classic shape is read-then-write: SELECT a balance, compute a new one in application code, UPDATE. Under Read Committed nothing stops two requests doing that concurrently.",
    topicIds: ["transactions.isolation-levels", "transactions.lost-update"],
    tier: 1,
    speed: [
      {
        question: "What can still go wrong under Read Committed?",
        correct:
          "Two identical SELECTs in one transaction can return different rows",
        distractors: [
          "You can read a value that was never committed by anyone",
          "Writes can be silently discarded without any error",
          "Rows you have already written can disappear mid-transaction",
        ],
      },
      {
        question: "What does Read Committed prevent?",
        correct:
          "Dirty reads — you never see a value from an uncommitted transaction",
        distractors: [
          "Non-repeatable reads within one transaction",
          "Phantom rows appearing between two identical queries",
          "Lost updates in read-modify-write sequences",
        ],
      },
    ],
  },
  {
    id: "repeatable-read",
    prompt: "What does Repeatable Read add over Read Committed?",
    answer:
      "A stable snapshot for the whole transaction: every read sees the database as of the transaction's start, so re-reading a row always returns the same value. In Postgres this is snapshot isolation, which also prevents phantoms, and a transaction that tries to write a row another transaction has modified since the snapshot fails with a serialization error rather than silently overwriting it. That failure is a feature — but it means the application has to be prepared to retry.",
    emFraming:
      "The practical consequence people miss: raising isolation moves the problem from silent corruption to visible errors your code must handle. If you raise the level and do not add retry handling, you have traded a rare wrong answer for a regular 500.",
    topicIds: ["transactions.isolation-levels", "transactions.mvcc"],
    tier: 1,
    speed: [
      {
        question:
          "In Postgres, what happens when a Repeatable Read transaction writes a row another transaction changed since its snapshot?",
        correct:
          "It fails with a serialization error, so the application must retry",
        distractors: [
          "It silently overwrites, because last write wins",
          "It blocks until the other transaction commits, then proceeds",
          "It sees the newer value and applies the change on top of it",
        ],
      },
    ],
  },
  {
    id: "serializable-tradeoffs",
    prompt: "What does Serializable give you, and what does it cost?",
    answer:
      "The strongest guarantee: the result is identical to some serial ordering of the transactions, so no concurrency anomaly is possible and you can reason about your code as if it ran alone. The cost is throughput and failure handling — either heavy locking, or in Postgres's SSI, tracking read/write dependencies and aborting transactions that would violate serializability. Under contention the abort rate climbs, and every transaction needs a retry loop.",
    emFraming:
      "The honest position is that Serializable is cheap when contention is low and expensive exactly when you need it. Use it for the handful of operations with real invariants, not as a blanket setting.",
    topicIds: ["transactions.isolation-levels"],
    tier: 2,
    speed: [
      {
        question: "What does Serializable cost you?",
        correct:
          "Throughput under contention, and a retry loop for every transaction",
        distractors: [
          "Read consistency, since readers now block on writers",
          "Durability, because commits are deferred until the batch resolves",
          "Nothing measurable on modern engines — it is the sensible default",
        ],
      },
    ],
  },
  {
    id: "lost-update",
    prompt:
      "Two requests both read a counter of 10, both add 1, both write 11. Name the anomaly and give three fixes.",
    answer:
      "A lost update — one increment vanished, and no error was raised. Fixes: (1) do the arithmetic in the database, `UPDATE ... SET n = n + 1`, so the read and write are one atomic statement; (2) pessimistic locking, `SELECT ... FOR UPDATE`, so the second reader waits; (3) optimistic locking with a version column, where the update is conditional on the version you read and fails if it changed. The general shape is read-modify-write in application code, and it is only safe if something makes the sequence atomic.",
    emFraming:
      "The reason this survives code review is that it is correct in every test with one user and wrong only under concurrency. Ask what happens if the same request arrives twice in the same millisecond — the answer should not be a shrug.",
    topicIds: [
      "transactions.lost-update",
      "transactions.optimistic-locking",
      "transactions.isolation-levels",
    ],
    tier: 1,
    speed: [
      {
        question:
          "Two requests read 10, add 1, write 11. Which fix does NOT solve it?",
        correct: "Raising the isolation level to Read Committed",
        distractors: [
          "UPDATE ... SET n = n + 1, doing the arithmetic in the database",
          "SELECT ... FOR UPDATE, so the second reader waits",
          "A version column, so the second write fails and retries",
        ],
      },
      {
        question: "Why does a lost update usually survive code review?",
        correct: "It is correct with one user and only wrong under concurrency",
        distractors: [
          "It only appears at isolation levels most teams never use",
          "It requires a specific database engine to reproduce",
          "The symptom is an error, and errors get noticed",
        ],
      },
    ],
  },
  {
    id: "mvcc-why",
    prompt:
      "Why do databases keep multiple versions of a row rather than updating it in place?",
    answer:
      "So that readers and writers stop blocking each other. With multi-version concurrency control, an update writes a new version rather than overwriting; each transaction sees the version that was current as of its snapshot. A long-running read therefore gets a consistent view without holding locks that would stall writers, and writers proceed without waiting for readers to finish. The costs are storage for old versions and a process to reclaim them — Postgres's vacuum, and the bloat that follows when it cannot keep up.",
    expands: "Multi-Version Concurrency Control",
    emFraming:
      "The operational tail of this matters: long-lived transactions hold back the cleanup horizon, so one forgotten open transaction in a reporting job can bloat a production database. 'Why is the disk full' is often 'who left a transaction open'.",
    topicIds: ["transactions.mvcc"],
    tier: 1,
    speed: [
      {
        question: "What is the operational cost of MVCC?",
        correct:
          "Old row versions accumulate and must be reclaimed — bloat when cleanup falls behind",
        distractors: [
          "Writes must wait for all open readers to finish",
          "Every read consumes a lock that must be released explicitly",
          "Indexes have to be rebuilt after each vacuum",
        ],
      },
      {
        question: "What does MVCC buy you?",
        correct: "Readers and writers stop blocking each other",
        distractors: [
          "Writes become atomic without needing a transaction log",
          "Indexes no longer need to be updated on every write",
          "Rows can be updated without acquiring any lock at all",
        ],
      },
    ],
  },
  {
    id: "mvcc-snapshot",
    prompt:
      "Under MVCC, how does a long analytical read see a consistent picture without blocking writes?",
    answer:
      "It takes a snapshot — effectively a marker of which transactions had committed at the moment it began. Every row it reads is resolved to the newest version visible as of that marker, ignoring anything committed later. Writers carry on creating new versions the whole time; they are simply invisible to this reader. So the read is consistent as of a point in time, and is stale by however long it has been running.",
    expands: "Multi-Version Concurrency Control",
    emFraming:
      "This is why 'the report disagrees with the dashboard' is often not a bug. Worth being able to say out loud: the report is consistent, just as of ten minutes ago.",
    topicIds: ["transactions.mvcc", "consistency.eventual"],
    tier: 2,
    speed: [
      {
        question: "A long analytical read under MVCC sees…",
        correct:
          "A consistent picture as of when it started — correct, and stale by however long it has run",
        distractors: [
          "The newest committed value for each row as it reaches it",
          "Whatever the leader has, blocking writers for the duration",
          "An inconsistent mix, which is why reports disagree with dashboards",
        ],
      },
    ],
  },
  {
    id: "optimistic-locking",
    prompt:
      "Describe the canonical optimistic locking pattern with a version column.",
    answer:
      "Read the row along with its version. Do the work in application code. Then `UPDATE ... SET value = ?, version = version + 1 WHERE id = ? AND version = ?` using the version you read. If the update affects zero rows, somebody else changed it first: you re-read and retry, or return a conflict to the user. No locks are held while the user or the application is thinking, and the check and the write are one atomic statement.",
    emFraming:
      "This is also what makes a good HTTP concurrency story — the version maps directly onto an ETag with If-Match, so the conflict surfaces at the API rather than as a silent overwrite of somebody else's edit.",
    topicIds: ["transactions.optimistic-locking", "transactions.lost-update"],
    tier: 1,
    speed: [
      {
        question:
          "In the optimistic locking pattern, what tells you a conflict happened?",
        correct:
          "The UPDATE affects zero rows, because the version no longer matches",
        distractors: [
          "The database raises a deadlock error",
          "A SELECT ... FOR UPDATE times out waiting for the lock",
          "The transaction is aborted with a serialization failure",
        ],
      },
    ],
  },
  {
    id: "optimistic-vs-pessimistic",
    prompt:
      "When would you choose optimistic locking over pessimistic, and when the reverse?",
    answer:
      "Optimistic when conflicts are rare, when the work between read and write is long or involves a human, or when holding a lock across that gap would be unacceptable — you pay only when a conflict actually happens, with a retry. Pessimistic when conflicts are common enough that retry loops would thrash, when the operation is short and entirely inside the database, or when retrying is expensive or impossible. The deciding question is the conflict rate: optimistic is cheap under low contention and degrades badly under high contention, and pessimistic is the reverse.",
    emFraming:
      "Never hold a pessimistic lock across a user's thinking time or a network call to another service — that is how you get a lock held for thirty seconds and a queue of blocked requests behind it.",
    topicIds: [
      "transactions.optimistic-locking",
      "transactions.pessimistic-locking",
    ],
    tier: 1,
    speed: [
      {
        question: "When is optimistic locking the wrong choice?",
        correct: "When conflicts are frequent, so retry loops thrash",
        distractors: [
          "When the work between read and write involves a human",
          "When the operation spans a call to another service",
          "When the row is read far more often than it is written",
        ],
      },
    ],
  },
  {
    id: "select-for-update",
    prompt: "What does SELECT ... FOR UPDATE do, conceptually?",
    answer:
      "It reads the rows and takes a write lock on each one for the rest of the transaction, so any other transaction trying to read-for-update or modify those rows waits until you commit or roll back. It turns a read-modify-write sequence into something safe by serialising access to those particular rows. The cost is that everything else contending for them blocks, and the lock lives until the transaction ends — so a transaction that stays open holds the queue.",
    emFraming:
      "Two things to insist on in review: lock rows in a consistent order across the codebase (out-of-order locking is how deadlocks appear), and never leave a network call inside the locked section.",
    topicIds: ["transactions.pessimistic-locking", "transactions.deadlocks"],
    tier: 1,
    speed: [
      {
        question:
          "What is the main rule to follow when using SELECT ... FOR UPDATE?",
        correct:
          "Lock rows in a consistent order, and never hold the lock across a network call",
        distractors: [
          "Always lock the whole table to avoid gap locks",
          "Take the lock as early as possible, before any other work",
          "Set a low isolation level so the lock is released sooner",
        ],
      },
    ],
  },
  {
    id: "deadlocks",
    prompt:
      "How does a deadlock arise between two transactions, and how do you prevent them?",
    answer:
      "Transaction A locks row 1 and wants row 2; transaction B locks row 2 and wants row 1. Neither can proceed and neither will release, so the database detects the cycle and kills one with a deadlock error. Prevention is mostly discipline: acquire locks in a consistent order everywhere, keep transactions short, lock as few rows as late as possible, and use lower-contention patterns such as optimistic locking where you can. Detection is automatic — the application's job is to retry the victim.",
    emFraming:
      "Rising deadlock rates are a design signal, not a tuning problem. They usually mean two code paths touch the same rows in different orders, and the fix is in the code rather than in the database configuration.",
    topicIds: ["transactions.deadlocks", "transactions.pessimistic-locking"],
    tier: 1,
    speed: [
      {
        question: "What is the usual root cause of rising deadlock rates?",
        correct: "Two code paths touching the same rows in different orders",
        distractors: [
          "Transactions being held open too long by slow queries",
          "Too many concurrent connections for the pool size",
          "An isolation level set higher than the workload needs",
        ],
      },
    ],
  },
  {
    id: "idempotency-principle",
    prompt:
      "State the core design principle of idempotency, and why distributed systems cannot avoid needing it.",
    answer:
      "Performing an operation more than once has the same effect as performing it once. It is unavoidable because a network gives you no way to distinguish 'the request never arrived' from 'the request was processed and the response was lost' — a timeout is an unknown, not a failure. Any system that retries (and every reliable system retries) will therefore sometimes execute the same logical operation twice. Idempotency is what makes that safe, and it is the only thing that does.",
    emFraming:
      "The reframing worth carrying into design reviews: you are not choosing whether duplicates happen, only whether they are harmless. At-least-once delivery plus idempotent handling is the shape of essentially every reliable pipeline.",
    topicIds: [
      "transactions.idempotency",
      "messaging.delivery-semantics",
      "reliability.retries-and-jitter",
    ],
    tier: 1,
    speed: [
      {
        question: "Why is idempotency unavoidable in a distributed system?",
        correct:
          "A timeout cannot distinguish 'never arrived' from 'processed, response lost'",
        distractors: [
          "Message brokers reorder messages, so replays are inevitable",
          "Clocks drift between nodes, so ordering cannot be trusted",
          "Network partitions mean some writes are applied twice by design",
        ],
      },
      {
        question:
          "What is the practical consequence of accepting that duplicates will happen?",
        correct:
          "At-least-once delivery plus idempotent handling becomes the default shape",
        distractors: [
          "You need a broker that guarantees exactly-once semantics",
          "Retries should be removed from clients and handled centrally",
          "Every operation must run inside a distributed transaction",
        ],
      },
    ],
  },
  {
    id: "naturally-idempotent-transitions",
    prompt:
      "What makes a state transition naturally idempotent, and how does that differ from deduplicating with keys?",
    answer:
      "Writing an absolute target state rather than a relative change: 'set status to shipped' or 'set quantity to 5' gives the same result however many times it runs, whereas 'increment quantity by 1' does not. Conditional transitions are the same idea — `UPDATE ... SET status='shipped' WHERE status='packed'` applies once and then matches nothing. The difference from an idempotency key is that this needs no extra bookkeeping: the operation's own shape makes replay harmless, rather than a separate record remembering that you have seen this request before.",
    emFraming:
      "Preferring absolute over relative updates in APIs and events costs nothing at design time and removes a whole class of duplicate-delivery bugs. Deltas are the thing that makes exactly-once feel necessary.",
    topicIds: ["transactions.idempotency", "messaging.delivery-semantics"],
    tier: 2,
    speed: [
      {
        question: "Which operation is naturally idempotent?",
        correct: "SET status = 'shipped'",
        distractors: [
          "INCREMENT quantity BY 1",
          "APPEND item TO list",
          "ADJUST balance BY -10",
        ],
      },
    ],
  },
  {
    id: "dedup-unique-constraints",
    prompt:
      "How do unique constraints and deduplication tables provide idempotency, and what is the pitfall?",
    answer:
      "Give each logical operation a stable identifier and store it with a unique constraint — either as a column on the affected row or in a dedicated dedup table. The first attempt inserts and proceeds; a duplicate violates the constraint, which you catch and treat as success, returning the original result. The pitfall is atomicity: the dedup record and the side effect must commit together. Recording the key first and then failing means the operation never happens and can never be retried; doing the work first and then recording means a crash in between leaves it repeatable.",
    emFraming:
      "The database's unique index is doing the hard part here — it is the only component that can make 'has this happened before' a race-free question. Reaching for an application-level check-then-insert reintroduces exactly the race you were trying to remove.",
    topicIds: [
      "transactions.idempotency",
      "transactions.atomicity",
      "data-stores.indexing",
    ],
    tier: 2,
    speed: [
      {
        question:
          "What is the pitfall when deduplicating with a key and a unique constraint?",
        correct:
          "The dedup record and the side effect must commit together, or a crash between them breaks it",
        distractors: [
          "Unique constraints cannot be enforced across partitions",
          "The key must be generated by the server to guarantee uniqueness",
          "Retries will hit the constraint and surface an error to the user",
        ],
      },
    ],
  },
  {
    id: "upserts",
    prompt:
      "What is an upsert, and why is it better than SELECT-then-INSERT-or-UPDATE?",
    answer:
      "A single statement that inserts a row or, if it conflicts with an existing key, updates it instead — `INSERT ... ON CONFLICT DO UPDATE` in Postgres, `MERGE` in the standard. It is better because the check and the write are one atomic operation resolved by the database against a unique index. The application-level version has a race between the SELECT and the write, so two concurrent requests both find nothing, both insert, and one gets a constraint violation or a duplicate row.",
    emFraming:
      "Upserts make consumers of at-least-once event streams straightforward: process the same event twice and the second one simply overwrites with identical values. It is the single most useful tool for idempotent projections.",
    topicIds: [
      "transactions.upsert",
      "transactions.idempotency",
      "transactions.lost-update",
    ],
    tier: 1,
    speed: [
      {
        question: "Why is an upsert better than SELECT-then-INSERT-or-UPDATE?",
        correct:
          "It is one atomic statement resolved against a unique index, so there is no race",
        distractors: [
          "It avoids a second network round trip to the database",
          "It works at a lower isolation level than the two-statement version",
          "It locks fewer rows, so it reduces deadlock risk",
        ],
      },
    ],
  },
]
