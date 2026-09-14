import type { ComponentKind, ComponentSpec } from "./types"

/**
 * Component catalogue.
 *
 * These numbers are global -- every scenario is graded against the same physics.
 * They are therefore never tuned to make an individual scenario winnable; if a
 * scenario is unwinnable, the scenario is wrong, not the catalogue.
 *
 * Figures are deliberately round and are meant to be *defensible*, not exact:
 * roughly a small managed instance of each thing on a major cloud, circa now.
 * `baselineAvailability` is the availability of ONE instance in ONE failure
 * domain.
 */

export const HOURS_PER_MONTH = 730

export const CATALOGUE: Partial<Record<ComponentKind, ComponentSpec>> = {
  "load-balancer": {
    kind: "load-balancer",
    label: "Load balancer (L7)",
    capacity: { readRps: 10_000, writeRps: 10_000 },
    baseLatency: { p50Ms: 2, p99Ms: 8 },
    baselineAvailability: 0.9995,
    stateful: false,
    durable: false,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "alb", label: "AWS Application Load Balancer", family: "aws" },
      { id: "gclb", label: "Google Cloud Load Balancing", family: "gcp" },
      { id: "azure-lb", label: "Azure Load Balancer", family: "azure" },
      { id: "nginx", label: "nginx", family: "self-hosted" },
      { id: "haproxy", label: "HAProxy", family: "self-hosted" },
    ],
    routesTraffic: true,
    costPerInstanceHourUsd: 0.025, // ~$18/mo
    failureModes: ["az-loss", "region-loss"],
    supports: { replicas: false },
  },

  "app-server": {
    kind: "app-server",
    label: "App server",
    capacity: { readRps: 200, writeRps: 200 },
    baseLatency: { p50Ms: 25, p99Ms: 80 },
    baselineAvailability: 0.99,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "ecs", label: "AWS ECS / Fargate", family: "aws" },
      { id: "cloud-run", label: "Google Cloud Run", family: "gcp" },
      { id: "azure-app", label: "Azure App Service", family: "azure" },
      { id: "fly", label: "Fly.io", family: "independent" },
      { id: "k8s", label: "Self-managed Kubernetes", family: "self-hosted" },
    ],
    routesTraffic: false,
    costPerInstanceHourUsd: 0.04, // ~$29/mo
    failureModes: ["process-crash", "az-loss", "connection-exhaustion"],
    supports: { replicas: false, autoscale: true, sessionStore: true },
  },

  "sql-primary": {
    kind: "sql-primary",
    label: "SQL primary",
    // Writes cost ~5x a read: durability, WAL, index maintenance.
    capacity: { readRps: 2_000, writeRps: 400 },
    baseLatency: { p50Ms: 5, p99Ms: 25 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: true,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "rds", label: "AWS RDS for Postgres", family: "aws" },
      { id: "cloud-sql", label: "Google Cloud SQL", family: "gcp" },
      { id: "azure-pg", label: "Azure Database for Postgres", family: "azure" },
      { id: "supabase", label: "Supabase", family: "independent" },
      { id: "neon", label: "Neon", family: "independent" },
      { id: "pg-self", label: "Self-managed Postgres", family: "self-hosted" },
    ],
    routesTraffic: false,
    costPerInstanceHourUsd: 0.17, // ~$124/mo
    failureModes: ["disk-failure", "az-loss", "connection-exhaustion"],
    supports: {
      replicas: true,
      consistencyModes: ["strong"],
      encryptionAtRest: true,
      backups: true,
    },
  },

  "sql-replica": {
    kind: "sql-replica",
    label: "SQL read replica",
    // writeRps 0 is the point: routing writes here is a mistake the engine can see.
    capacity: { readRps: 2_000, writeRps: 0 },
    baseLatency: { p50Ms: 5, p99Ms: 25 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: true,
    managed: false,
    optionalOnPath: true,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "rds", label: "AWS RDS read replica", family: "aws" },
      { id: "cloud-sql", label: "Google Cloud SQL replica", family: "gcp" },
      { id: "azure-pg", label: "Azure Postgres replica", family: "azure" },
      {
        id: "pg-self",
        label: "Self-managed streaming replica",
        family: "self-hosted",
      },
    ],
    routesTraffic: false,
    costPerInstanceHourUsd: 0.17, // ~$124/mo
    failureModes: ["disk-failure", "az-loss", "replication-stall"],
    supports: {
      replicas: false,
      consistencyModes: ["eventual"],
      encryptionAtRest: true,
    },
  },

  cache: {
    kind: "cache",
    label: "In-memory cache",
    capacity: { readRps: 50_000, writeRps: 50_000 },
    baseLatency: { p50Ms: 1, p99Ms: 3 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: false,
    managed: false,
    optionalOnPath: true,
    clientSide: false,
    caches: true,
    canAddRedundancy: true,
    vendors: [
      { id: "elasticache", label: "AWS ElastiCache", family: "aws" },
      { id: "memorystore", label: "Google Memorystore", family: "gcp" },
      { id: "azure-redis", label: "Azure Cache for Redis", family: "azure" },
      { id: "redis-cloud", label: "Redis Cloud", family: "independent" },
      { id: "redis-self", label: "Self-managed Redis", family: "self-hosted" },
    ],
    routesTraffic: false,
    costPerInstanceHourUsd: 0.03, // ~$22/mo
    failureModes: ["process-crash", "az-loss", "cache-eviction-storm"],
    supports: {
      replicas: true,
      consistencyModes: ["eventual"],
      sessionStore: true,
    },
  },

  cdn: {
    kind: "cdn",
    label: "CDN",
    // Writes are proxied straight through, not cached. A real CDN passes a POST
    // to the origin without complaint, so refusing them here would invent a
    // mistake that does not exist.
    capacity: { readRps: 100_000, writeRps: 50_000 },
    baseLatency: { p50Ms: 15, p99Ms: 40 },
    baselineAvailability: 0.9999,
    stateful: false,
    durable: false,
    managed: true,
    optionalOnPath: true,
    clientSide: false,
    caches: true,
    canAddRedundancy: true,
    vendors: [
      { id: "cloudflare", label: "Cloudflare", family: "cloudflare" },
      { id: "cloudfront", label: "AWS CloudFront", family: "aws" },
      { id: "fastly", label: "Fastly", family: "independent" },
      { id: "akamai", label: "Akamai", family: "independent" },
      { id: "gcp-cdn", label: "Google Cloud CDN", family: "gcp" },
    ],
    routesTraffic: true,
    costPerInstanceHourUsd: 0.015, // ~$11/mo at this scale
    failureModes: [],
    supports: { replicas: false, consistencyModes: ["eventual"] },
  },

  "api-gateway": {
    kind: "api-gateway",
    label: "API gateway",
    capacity: { readRps: 5_000, writeRps: 5_000 },
    baseLatency: { p50Ms: 4, p99Ms: 15 },
    baselineAvailability: 0.9995,
    stateful: false,
    durable: false,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "apigw", label: "AWS API Gateway", family: "aws" },
      { id: "apigee", label: "Google Apigee", family: "gcp" },
      { id: "azure-apim", label: "Azure API Management", family: "azure" },
      { id: "kong", label: "Kong", family: "self-hosted" },
    ],
    routesTraffic: true,
    costPerInstanceHourUsd: 0.045, // ~$33/mo
    failureModes: ["az-loss", "region-loss"],
    supports: { replicas: false },
  },

  queue: {
    kind: "queue",
    label: "Queue",
    capacity: { readRps: 10_000, writeRps: 10_000 },
    baseLatency: { p50Ms: 5, p99Ms: 20 },
    baselineAvailability: 0.9999,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "sqs", label: "AWS SQS", family: "aws" },
      { id: "pubsub", label: "Google Pub/Sub", family: "gcp" },
      { id: "servicebus", label: "Azure Service Bus", family: "azure" },
      { id: "rabbitmq", label: "RabbitMQ", family: "self-hosted" },
      { id: "kafka", label: "Apache Kafka", family: "self-hosted" },
    ],
    // Competing consumers: messages are divided between them, not copied.
    routesTraffic: true,
    costPerInstanceHourUsd: 0.02, // ~$15/mo
    failureModes: ["az-loss"],
    supports: { replicas: false },
  },

  worker: {
    kind: "worker",
    label: "Worker",
    // Background compute -- image processing, OCR, thumbnailing. Far more
    // expensive per item than serving a web request, which is the whole reason
    // it belongs off the request path.
    capacity: { readRps: 40, writeRps: 40 },
    baseLatency: { p50Ms: 400, p99Ms: 1_500 },
    baselineAvailability: 0.99,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "ecs", label: "AWS ECS / Fargate", family: "aws" },
      { id: "cloud-run-jobs", label: "Google Cloud Run Jobs", family: "gcp" },
      { id: "azure-container", label: "Azure Container Apps", family: "azure" },
      { id: "k8s", label: "Self-managed Kubernetes", family: "self-hosted" },
    ],
    routesTraffic: false,
    costPerInstanceHourUsd: 0.08, // ~$58/mo
    failureModes: ["process-crash", "az-loss"],
    supports: { replicas: false, autoscale: true },
  },

  "gpu-worker": {
    kind: "gpu-worker",
    label: "GPU / render worker",
    // Rendering a video or running a model is seconds of work, not
    // milliseconds. One instance finishing roughly one job a second is
    // generous; the point is that capacity here is bought by the job, and the
    // fleet becomes the largest line on the bill.
    capacity: { readRps: 1, writeRps: 1 },
    baseLatency: { p50Ms: 900, p99Ms: 4_000 },
    baselineAvailability: 0.99,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    canAddRedundancy: true,
    caches: false,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.9, // ~$657/mo -- accelerated instances are not cheap
    failureModes: ["process-crash", "az-loss"],
    supports: { replicas: false, autoscale: true },
    vendors: [
      { id: "ec2-gpu", label: "AWS EC2 GPU instances", family: "aws" },
      { id: "gcp-gpu", label: "Google Compute GPU", family: "gcp" },
      { id: "azure-gpu", label: "Azure NC-series", family: "azure" },
      { id: "modal", label: "Modal", family: "independent" },
      { id: "runpod", label: "RunPod", family: "independent" },
    ],
  },

  "object-store": {
    kind: "object-store",
    label: "Object store",
    capacity: { readRps: 5_000, writeRps: 1_000 },
    baseLatency: { p50Ms: 25, p99Ms: 90 },
    baselineAvailability: 0.9999,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: true,
    vendors: [
      { id: "s3", label: "AWS S3", family: "aws" },
      { id: "gcs", label: "Google Cloud Storage", family: "gcp" },
      { id: "azure-blob", label: "Azure Blob Storage", family: "azure" },
      { id: "r2", label: "Cloudflare R2", family: "cloudflare" },
      { id: "minio", label: "MinIO", family: "self-hosted" },
    ],
    routesTraffic: false,
    costPerInstanceHourUsd: 0.03, // ~$22/mo at this volume
    failureModes: ["region-loss"],
    supports: { replicas: false, encryptionAtRest: true },
  },

  "third-party-api": {
    kind: "third-party-api",
    label: "Third-party API",
    // Someone else's system. You cannot add instances, you cannot tune it, and
    // its availability is a ceiling on yours wherever it sits on the synchronous
    // path. The latency is theirs too -- note the p99.
    capacity: { readRps: 500, writeRps: 500 },
    baseLatency: { p50Ms: 120, p99Ms: 600 },
    baselineAvailability: 0.995,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    caches: false,
    canAddRedundancy: false,
    vendors: [
      { id: "stripe", label: "Stripe", family: "independent" },
      { id: "adyen", label: "Adyen", family: "independent" },
      { id: "braintree", label: "Braintree", family: "independent" },
      { id: "paypal", label: "PayPal", family: "independent" },
    ],
    routesTraffic: false,
    costPerInstanceHourUsd: 0, // billed per transaction, not per hour
    failureModes: ["region-loss"],
    supports: { replicas: false },
  },

  "log-stream": {
    kind: "log-stream",
    label: "Event log (Kafka)",
    // An ordered, retained log rather than a queue: reading does not consume,
    // so several independent consumer groups can each read all of it.
    capacity: { readRps: 50_000, writeRps: 50_000 },
    baseLatency: { p50Ms: 4, p99Ms: 18 },
    baselineAvailability: 0.9995,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    canAddRedundancy: true,
    caches: false,
    routesTraffic: false,
    // NOT a router: every consumer group receives the whole stream. Splitting
    // it between them would model a queue, which is the other thing entirely.
    costPerInstanceHourUsd: 0.12, // ~$88/mo per broker
    failureModes: ["az-loss", "disk-failure", "replication-stall"],
    supports: { replicas: true, consistencyModes: ["strong"] },
    vendors: [
      { id: "msk", label: "AWS MSK", family: "aws" },
      { id: "confluent", label: "Confluent Cloud", family: "independent" },
      { id: "gcp-kafka", label: "Google Managed Kafka", family: "gcp" },
      { id: "eventhubs", label: "Azure Event Hubs", family: "azure" },
      { id: "kafka-self", label: "Self-managed Kafka", family: "self-hosted" },
    ],
  },

  "shard-router": {
    kind: "shard-router",
    label: "Shard router",
    capacity: { readRps: 20_000, writeRps: 20_000 },
    baseLatency: { p50Ms: 2, p99Ms: 8 },
    baselineAvailability: 0.9995,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    canAddRedundancy: true,
    caches: false,
    // Routes each key to its shard, so traffic divides between the shards.
    routesTraffic: true,
    costPerInstanceHourUsd: 0.04,
    failureModes: ["process-crash", "az-loss"],
    supports: { replicas: false },
    vendors: [
      { id: "vitess", label: "Vitess", family: "self-hosted" },
      { id: "citus", label: "Citus", family: "self-hosted" },
      { id: "proxysql", label: "ProxySQL", family: "self-hosted" },
      {
        id: "app-level",
        label: "Application-level routing",
        family: "self-hosted",
      },
    ],
  },

  "nosql-node": {
    kind: "nosql-node",
    label: "Wide-column / KV store",
    // Tuned for a known access pattern, so far more throughput per node than a
    // relational primary -- at the cost of joins and ad-hoc queries.
    capacity: { readRps: 10_000, writeRps: 6_000 },
    baseLatency: { p50Ms: 4, p99Ms: 20 },
    baselineAvailability: 0.999,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: false,
    clientSide: false,
    canAddRedundancy: true,
    caches: false,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.15, // ~$110/mo
    failureModes: ["disk-failure", "az-loss", "replication-stall"],
    supports: {
      replicas: true,
      consistencyModes: ["strong", "quorum", "eventual"],
      encryptionAtRest: true,
      backups: true,
    },
    vendors: [
      { id: "dynamodb", label: "AWS DynamoDB", family: "aws" },
      { id: "bigtable", label: "Google Bigtable", family: "gcp" },
      { id: "cosmos", label: "Azure Cosmos DB", family: "azure" },
      { id: "cassandra", label: "Apache Cassandra", family: "self-hosted" },
      { id: "scylla", label: "ScyllaDB", family: "self-hosted" },
    ],
  },

  "search-index": {
    kind: "search-index",
    label: "Search index",
    capacity: { readRps: 3_000, writeRps: 800 },
    baseLatency: { p50Ms: 15, p99Ms: 60 },
    baselineAvailability: 0.999,
    stateful: true,
    durable: true,
    managed: true,
    // Derived state: it can be rebuilt from the authoritative store, so losing
    // it degrades search rather than losing data.
    optionalOnPath: true,
    clientSide: false,
    canAddRedundancy: true,
    caches: false,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.11, // ~$80/mo
    failureModes: ["az-loss", "disk-failure", "replication-stall"],
    supports: {
      replicas: true,
      consistencyModes: ["eventual"],
      encryptionAtRest: true,
    },
    vendors: [
      { id: "opensearch", label: "AWS OpenSearch", family: "aws" },
      { id: "elastic", label: "Elastic Cloud", family: "independent" },
      { id: "algolia", label: "Algolia", family: "independent" },
      { id: "typesense", label: "Typesense", family: "self-hosted" },
      {
        id: "es-self",
        label: "Self-managed Elasticsearch",
        family: "self-hosted",
      },
    ],
  },

  "stream-processor": {
    kind: "stream-processor",
    label: "Stream processor",
    capacity: { readRps: 5_000, writeRps: 5_000 },
    baseLatency: { p50Ms: 30, p99Ms: 150 },
    baselineAvailability: 0.99,
    stateful: true,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: false,
    canAddRedundancy: true,
    caches: false,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.09,
    failureModes: ["process-crash", "az-loss"],
    supports: { replicas: false, autoscale: true },
    vendors: [
      { id: "flink", label: "Apache Flink", family: "self-hosted" },
      { id: "kinesis-analytics", label: "AWS Managed Flink", family: "aws" },
      { id: "dataflow", label: "Google Dataflow", family: "gcp" },
      { id: "kstreams", label: "Kafka Streams", family: "self-hosted" },
    ],
  },

  "data-warehouse": {
    kind: "data-warehouse",
    label: "Analytics warehouse",
    // Columnar and batch-oriented: enormous scan throughput, poor at serving a
    // request. Deliberately low rps to make "do not query it from the app" bite.
    capacity: { readRps: 200, writeRps: 2_000 },
    baseLatency: { p50Ms: 400, p99Ms: 2_500 },
    baselineAvailability: 0.999,
    stateful: true,
    durable: true,
    managed: true,
    optionalOnPath: true,
    clientSide: false,
    canAddRedundancy: true,
    caches: false,
    routesTraffic: false,
    costPerInstanceHourUsd: 0.2, // ~$146/mo
    failureModes: ["region-loss"],
    supports: { replicas: false, encryptionAtRest: true },
    vendors: [
      { id: "redshift", label: "AWS Redshift", family: "aws" },
      { id: "bigquery", label: "Google BigQuery", family: "gcp" },
      { id: "snowflake", label: "Snowflake", family: "independent" },
      { id: "databricks", label: "Databricks", family: "independent" },
      { id: "clickhouse", label: "ClickHouse", family: "self-hosted" },
    ],
  },

  "web-client": {
    kind: "web-client",
    label: "Web client",
    // Runs in the user's browser, so there is no server capacity to exhaust.
    capacity: {
      readRps: Number.MAX_SAFE_INTEGER,
      writeRps: Number.MAX_SAFE_INTEGER,
    },
    baseLatency: { p50Ms: 0, p99Ms: 0 },
    baselineAvailability: 1,
    stateful: false,
    durable: false,
    managed: false,
    optionalOnPath: false,
    clientSide: true,
    caches: false,
    canAddRedundancy: false,
    vendors: [
      { id: "vercel", label: "Vercel", family: "independent" },
      { id: "netlify", label: "Netlify", family: "independent" },
      { id: "cf-pages", label: "Cloudflare Pages", family: "cloudflare" },
      { id: "s3-cf", label: "S3 + CloudFront", family: "aws" },
    ],
    routesTraffic: true,
    costPerInstanceHourUsd: 0,
    failureModes: [],
    supports: { replicas: false },
  },
}

export function monthlyCostUsd(spec: ComponentSpec, instances: number): number {
  return spec.costPerInstanceHourUsd * HOURS_PER_MONTH * instances
}
