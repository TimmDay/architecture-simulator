import type { ArchitectureGraph, Scenario } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * Scenario 3 -- two hard problems in one product.
 *
 * The payment half teaches the thing that separates people who have run money
 * systems from people who have not: a timeout is not a failure, it is an
 * unknown, and the only safe way to retry an unknown is with an idempotency
 * key. It also teaches that a third party's availability is a ceiling on yours
 * wherever it sits on the request path.
 *
 * The receipt half teaches where work belongs. OCR costs hundreds of
 * milliseconds of CPU per image -- an order of magnitude more than serving a
 * page -- so doing it inside the request both blows the latency budget and
 * burns the app tier's capacity. And the images themselves belong in object
 * storage, not in rows.
 *
 * The two halves share one lesson worth having: the user should not wait for
 * work that does not have to happen now.
 */
export const receiptsAndPayments: Scenario = {
  id: "03-receipts-and-payments",
  title: "Receipts and Payments",
  family: "event-driven",
  level: 3,

  brief: `You build expenses software for small businesses. It does two things.

People pay their suppliers through it. You do not touch card details yourself --
a third-party payment provider does the actual money movement, and you call
their API. They are reliable, mostly. They are not fast.

People also photograph receipts with their phone, often several megabytes each,
frequently on bad hotel wifi. Those images get read by OCR and filed as
historical transactions against the right supplier and date, so the year-end
accounts add up.

Users will forgive a receipt taking a minute to appear. They will not forgive
being charged twice, and they will not forgive a receipt going missing.

It is January, and the tax deadline is in three weeks.`,

  features: [
    "user-accounts",
    "file-uploads",
    "background-processing",
    "payments",
    "reporting",
  ],

  requirements: {
    // The user-facing request. OCR runs afterwards and is not on this clock.
    p99Ms: 400,
    availability: 0.999,
    monthlyBudgetUsd: 900,
    durability: "durable",
    consistency: "read-your-writes",
    compliance: ["pii", "pci"],
  },

  loadProfiles: [
    {
      id: "ordinary",
      label: "An ordinary Tuesday",
      peakRps: 60,
      readWriteRatio: 3,
      shape: "steady",
      geography: "single-region",
      cacheableReadFraction: 0.35,
    },
    {
      id: "month-end",
      label: "Month end",
      peakRps: 200,
      readWriteRatio: 2,
      shape: "diurnal",
      geography: "single-region",
      cacheableReadFraction: 0.3,
    },
    {
      id: "tax-deadline",
      label: "Tax deadline, everybody at once",
      peakRps: 600,
      readWriteRatio: 2, // a year of receipts, uploaded in one evening
      shape: "spiky",
      geography: "single-region",
      cacheableReadFraction: 0.2,
    },
  ],

  faultScript: [
    [{ kind: "node-down", componentId: "app", instances: 1 }],
    // The provider does not go down. It goes slow, which is worse, because
    // nothing errors and your threads pile up waiting.
    [{ kind: "latency-spike", componentId: "payments", multiplier: 8 }],
    // Somebody photographs their thumb. The file is corrupt and always will be.
    [{ kind: "poison-message", componentId: "ocr-queue" }],
  ],

  availableKinds: [
    "web-client",
    "cdn",
    "load-balancer",
    "api-gateway",
    "app-server",
    "third-party-api",
    "queue",
    "worker",
    "object-store",
    "cache",
    "sql-primary",
    "sql-replica",
  ],

  topicIds: [
    "transactions.idempotency",
    "transactions.outbox",
    "reliability.circuit-breaker",
    "reliability.retries-and-jitter",
    "reliability.graceful-degradation",
    "messaging.queue-vs-log",
    "messaging.dlq",
    "messaging.backpressure",
    "messaging.delivery-semantics",
    "styles.event-driven",
    "data-stores.relational-vs-document",
    "security.pii-and-residency",
    "security.encryption-at-rest",
  ],
}

/**
 * Reference solution.
 *
 * The shape of the answer: the phone uploads straight to object storage so
 * multi-megabyte files never touch the app tier; the app enqueues a job and
 * returns; workers do the OCR and write transactions; the payment call carries
 * an idempotency key and sits behind a circuit breaker with a tight timeout.
 *
 * Cost: $18 LB + $175 app (3) + $124 db + $15 queue + $175 workers (3) + $22
 * object store = $529/mo against a $900 budget. The headroom is deliberate --
 * this scenario is not won by being frugal, it is won by putting the work in
 * the right place.
 */
export const receiptsAndPaymentsReference: ArchitectureGraph = {
  components: [
    {
      id: "lb",
      kind: "load-balancer",
      label: "Load balancer",
      instances: 1,
      region: "eu-west-1",
      config: { vendor: "alb", availabilityZones: 2, rateLimitRps: 50 },
    },
    {
      id: "app",
      kind: "app-server",
      label: "Expenses API",
      instances: 6,
      region: "eu-west-1",
      config: {
        vendor: "ecs",
        availabilityZones: 2,
        sessionStore: "none",
        authRequired: true,
        // The detail that stops a retry becoming a second charge.
        idempotencyKeys: true,
      },
    },
    {
      id: "payments",
      kind: "third-party-api",
      label: "Payment provider",
      instances: 1,
      region: "external",
      config: { vendor: "stripe", availabilityZones: 1 },
    },
    {
      id: "pay-queue",
      kind: "queue",
      label: "Payment queue",
      instances: 1,
      region: "eu-west-1",
      config: { vendor: "sqs", availabilityZones: 2, deadLetterQueue: true },
    },
    {
      id: "pay-worker",
      kind: "worker",
      label: "Payment workers",
      instances: 2,
      region: "eu-west-1",
      config: { vendor: "ecs", availabilityZones: 2, idempotencyKeys: true },
    },
    {
      id: "receipts",
      kind: "object-store",
      label: "Receipt images",
      instances: 1,
      region: "eu-west-1",
      config: { vendor: "s3", availabilityZones: 2, encryptedAtRest: true },
    },
    {
      id: "ocr-queue",
      kind: "queue",
      label: "OCR queue",
      instances: 1,
      region: "eu-west-1",
      config: { vendor: "sqs", availabilityZones: 2, deadLetterQueue: true },
    },
    {
      id: "ocr",
      kind: "worker",
      label: "OCR workers",
      instances: 3,
      region: "eu-west-1",
      config: {
        vendor: "ecs",
        availabilityZones: 2,
        autoscale: { minInstances: 1, maxInstances: 12 },
      },
    },
    {
      id: "db",
      kind: "sql-primary",
      label: "Transactions database",
      instances: 1,
      region: "eu-west-1",
      config: {
        vendor: "rds",
        availabilityZones: 1,
        consistency: "strong",
        standby: true,
        backups: { enabled: true, rpoMinutes: 5 },
        encryptedAtRest: true,
      },
    },
  ],

  edges: [
    {
      // Weighted: three quarters of write traffic is ordinary API calls, one
      // quarter is a photograph going straight to storage.
      id: "u-lb",
      from: CLIENT_NODE_ID,
      to: "lb",
      kind: "sync-request",
      carries: "all",
      fanout: 3,
    },
    {
      id: "lb-app",
      from: "lb",
      to: "app",
      kind: "sync-request",
      carries: "all",
    },
    {
      // The phone uploads directly with a pre-signed URL. The bytes never pass
      // through the app tier, which is why 6 instances is enough.
      id: "u-receipts",
      from: CLIENT_NODE_ID,
      to: "receipts",
      kind: "sync-request",
      carries: "writes",
      fanout: 1,
    },
    {
      // The provider's p99 is 600ms. Putting that on the user's critical path
      // would make a 400ms budget arithmetically impossible -- so the request
      // accepts the payment, enqueues it, and returns. Confirmation follows.
      id: "app-pay-queue",
      from: "app",
      to: "pay-queue",
      kind: "async-publish",
      carries: "writes",
      fanout: 0.15,
    },
    {
      id: "pay-queue-worker",
      from: "pay-queue",
      to: "pay-worker",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "worker-payments",
      from: "pay-worker",
      to: "payments",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 3_000,
      retries: 2,
      jitter: true,
      circuitBreaker: true,
    },
    {
      id: "pay-worker-db",
      from: "pay-worker",
      to: "db",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 2_000,
      retries: 2,
      jitter: true,
    },
    {
      // A quarter of writes are receipt uploads needing OCR. Without the
      // fraction, every expense edit would be treated as a photograph.
      id: "app-queue",
      from: "app",
      to: "ocr-queue",
      kind: "async-publish",
      carries: "writes",
      fanout: 0.25,
    },
    {
      id: "queue-ocr",
      from: "ocr-queue",
      to: "ocr",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "ocr-receipts",
      from: "ocr",
      to: "receipts",
      kind: "sync-request",
      carries: "reads",
      timeoutMs: 5_000,
    },
    {
      id: "ocr-db",
      from: "ocr",
      to: "db",
      kind: "sync-request",
      carries: "writes",
      timeoutMs: 2_000,
      retries: 2,
      jitter: true,
    },
    {
      id: "app-db",
      from: "app",
      to: "db",
      kind: "sync-request",
      carries: "all",
      timeoutMs: 2_000,
      retries: 2,
      jitter: true,
    },
  ],
}
