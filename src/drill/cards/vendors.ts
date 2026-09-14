import type { Card } from "../types"

export const vendorCards: Card[] = [
  {
    id: "egress-costs",
    prompt:
      "Why does egress deserve its own line in an architecture review, when storage and compute rarely do?",
    answer:
      "Because it is charged asymmetrically and scales with traffic rather than with what you own. Getting data into a cloud is free; getting it out costs roughly $0.05-0.12/GB, and crossing between providers or regions triggers it continuously. Storage and compute appear on the sticker price and are easy to estimate. Egress appears nowhere in a service's advertised cost, is invisible in a prototype, and grows with success — so it is the line item that turns a design decision made at 100 rps into a five-figure surprise at 10,000.",
    emFraming:
      "Practically, this is what makes chatty cross-cloud and cross-region links expensive, and it is why 'we'll just read it from the other provider' should be priced at projected volume before anyone builds it. It is also the main reason data gravity is real: the data stays where it is because moving it costs more than leaving it.",
    topicIds: ["cost.egress", "cost.unit-economics"],
    tier: 1,
    speed: [
      {
        question: "Why does egress deserve its own line in a review?",
        correct:
          "It is invisible in a prototype, scales with traffic, and appears in no service's sticker price",
        distractors: [
          "It is charged at a higher rate than compute per unit",
          "It is billed monthly in arrears, so it lags the forecast",
          "Providers cap it, so exceeding the cap throttles your service",
        ],
      },
    ],
  },
  {
    id: "vendor-concentration",
    prompt:
      "Your entire system runs on one cloud provider. Is that a problem, and what is the right response?",
    answer:
      "It is a risk, not a mistake, and the usual response to it is wrong. Single-provider means a correlated failure domain and a weakening negotiating position as you grow. But running a second cloud rarely fixes either: you get the lowest common denominator of both platforms, two IAM and networking models, two on-call skill sets, egress charges between them, and a layer of integration glue that nobody owns and that fails in ways neither status page explains. The proportionate responses are multi-region within the provider, an honest assessment of what an exit would cost, avoiding the most proprietary services for the most critical paths, and contract terms — not a second cloud.",
    emFraming:
      "When someone senior asks 'what if AWS goes down', the useful answer quantifies it: which regions, what our RTO is, and what a migration would actually take in engineer-months. Vague reassurance and reflexive multi-cloud are both failures to do that work.",
    topicIds: [
      "org.build-vs-buy",
      "reliability.failure-domains",
      "replication.rpo-rto",
    ],
    tier: 1,
    speed: [
      {
        question: "What is the proportionate response to single-provider risk?",
        correct:
          "Multi-region within that provider, plus knowing what an exit would actually cost",
        distractors: [
          "Running a second cloud in active-active",
          "Keeping a cold standby with another provider",
          "Abstracting every service behind your own interfaces",
        ],
      },
    ],
  },
  {
    id: "build-vs-buy",
    prompt:
      "What is the real cost comparison when deciding whether to self-host a database rather than use a managed one?",
    answer:
      "Not instance price against invoice. Self-hosting adds backups and, critically, tested restores; version upgrades and patching; failover configuration and rehearsal; monitoring you build yourself; and a permanent on-call obligation for a system whose worst failures happen at 3am. The right comparison is the managed service's cost against the fully-loaded cost of the engineering time to operate it properly, plus the risk that the person who set it up leaves. Self-hosting wins at genuine scale, where the managed premium becomes large, or where no managed option fits the requirement.",
    emFraming:
      "The question that settles most of these arguments: when did we last actually restore from a backup? Teams that self-host and cannot answer are not saving money, they are deferring an incident.",
    topicIds: [
      "org.build-vs-buy",
      "replication.rpo-rto",
      "cost.unit-economics",
    ],
    tier: 1,
    speed: [
      {
        question:
          "What is the right comparison when deciding whether to self-host a database?",
        correct:
          "The managed invoice against the fully-loaded cost of operating it properly",
        distractors: [
          "The instance price against the managed service's price",
          "Your current scale against the point where managed pricing overtakes hardware",
          "The feature list of each option against your requirements",
        ],
      },
    ],
  },
]
