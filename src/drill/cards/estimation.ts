import type { Card } from "../types"

export const estimationCards: Card[] = [
  {
    id: "latency-numbers",
    prompt:
      "Give the order of magnitude for: an L1 cache reference, a main-memory read, an SSD read, a datacentre round trip, and a cross-continent round trip. Why does knowing these matter?",
    answer:
      "Roughly: L1 cache ~1ns, main memory ~100ns, SSD random read ~100µs, round trip within a datacentre ~500µs, round trip London to New York ~70ms and to Sydney ~150ms. Each step is two to three orders of magnitude, which is the point. It means a design that turns one memory access into a network call has made it a thousand times slower, and that anything crossing an ocean has a floor you cannot optimise past. You use them to sanity-check a design in seconds: if a page needs twenty sequential cross-region calls, it cannot be fast, and no amount of tuning will change that.",
    emFraming:
      "Speed of light in fibre is about 200,000 km/s, so London to Sydney and back has a physical floor near 100ms whatever you do. Being able to say that out loud settles a surprising number of arguments about whether a design can meet its latency target, and it is the difference between 'we'll optimise it' and 'we need to move the data'.",
    topicIds: ["fundamentals.latency-numbers", "fundamentals.estimation"],
    tier: 1,
    speed: [
      {
        question: "Roughly how long is a round trip inside one datacentre?",
        correct: "About half a millisecond",
        distractors: [
          "About 10 microseconds",
          "About 10 milliseconds",
          "About 50 milliseconds",
        ],
      },
      {
        question:
          "Roughly how much slower is a main-memory read than an L1 cache reference?",
        correct: "About 100×",
        distractors: [
          "About 10×",
          "About 10,000×",
          "About the same — both are on-chip",
        ],
      },
      {
        question: "What sets the floor on a London–Sydney round trip?",
        correct:
          "The speed of light in fibre — about 100ms there and back, whatever you build",
        distractors: [
          "TCP slow start and the handshake cost",
          "The number of network hops between providers",
          "Congestion on undersea cables during peak hours",
        ],
      },
    ],
  },
  {
    id: "estimation-method",
    prompt:
      "How do you structure a back-of-envelope estimate in an interview, and what are you actually demonstrating?",
    answer:
      "Work forward in one chain and say the assumption at each step: daily active users → actions per user per day → requests per day → divide by 86,400 for average QPS → multiply by 2 to 10 for peak → multiply by bytes per request for bandwidth → multiply by retention for storage. Round aggressively: 86,400 is 100,000, a million users at ten actions each is ten million requests a day, which is roughly 100 QPS average. What you are demonstrating is not arithmetic but judgement — that you know which numbers drive the design, that you can carry an assumption forward without losing it, and that you will notice when an answer is absurd.",
    emFraming:
      "State assumptions out loud and invite correction: 'I'll assume ten million daily actives, say twenty actions each — stop me if that's wrong.' An interviewer who disagrees will tell you, and now you are designing together rather than being examined. The failure mode is silent arithmetic followed by a number nobody can audit.",
    topicIds: ["fundamentals.estimation", "interview.method"],
    tier: 1,
    speed: [
      {
        question: "Ten million requests a day is roughly what average QPS?",
        correct: "About 100",
        distractors: ["About 10", "About 1,000", "About 10,000"],
      },
      {
        question:
          "What multiplier gets you from average QPS to peak, as a first guess?",
        correct: "2× to 10×, depending on how concentrated the traffic is",
        distractors: [
          "1.2× — traffic is fairly flat in most products",
          "100× — peaks are usually two orders of magnitude",
          "None; you should design for average and autoscale",
        ],
      },
      {
        question:
          "What is the point of stating assumptions aloud during an estimate?",
        correct:
          "An interviewer who disagrees corrects you, and you end up designing together",
        distractors: [
          "It fills time while you think of the actual answer",
          "It shows you know the standard industry figures",
          "It lets you avoid committing to a number you might get wrong",
        ],
      },
    ],
  },
  {
    id: "tail-latency-amplification",
    prompt:
      "A request fans out to 100 services, each with a p99 of 10ms. What is the resulting p99, and what do you do about it?",
    answer:
      "Far worse than 10ms. If you must wait for all 100 and each independently has a 1% chance of being slow, the chance that at least one is slow is 1 − 0.99^100, about 63% — so the majority of requests hit somebody's tail, and your p99 is governed by the p99.99 of the components. This is tail latency amplification. Responses: reduce fanout, make calls concurrent rather than sequential, return partial results when a component is late, and use hedged requests — send a duplicate to another replica once the first exceeds the p95, and take whichever answers first.",
    emFraming:
      "The counterintuitive consequence is that at high fanout, the metric that matters is not each service's average or even its p99 but its worst percentiles, so shaving the tail of one slow dependency can be worth more than speeding up the median of everything. It also means fanout is a latency budget you spend, which is a good reason not to decompose a service further than you need.",
    topicIds: [
      "fundamentals.tail-latency",
      "reliability.hedged-requests",
      "fundamentals.percentiles",
    ],
    tier: 1,
    speed: [
      {
        question:
          "You fan out to 100 services each with a 1% chance of being slow. What fraction of requests hit at least one slow call?",
        correct: "About 63%",
        distractors: ["About 1%", "About 10%", "About 99%"],
      },
      {
        question: "What is a hedged request?",
        correct:
          "Sending a duplicate to another replica once the first exceeds p95, and taking whichever answers first",
        distractors: [
          "Retrying a failed request against a different instance",
          "Sending the request to two regions and merging both responses",
          "Splitting a large request into parallel parts and combining them",
        ],
      },
    ],
  },
  {
    id: "load-shedding",
    prompt:
      "Your service is overloaded. Why is shedding load better than queueing it, and how do you choose what to drop?",
    answer:
      "Because a queue under sustained overload does not recover — it converts an overload into unbounded latency, and by the time a request is served the caller has usually given up, so you burn capacity producing answers nobody wants. Shedding keeps the work you do useful: reject early and cheaply, before the expensive part, and return a clear signal so callers back off. What to drop is a product decision made in advance — retries before first attempts, background and batch traffic before interactive, free tier before paid, and non-essential features before the core flow.",
    emFraming:
      "The related control is admission control: deciding at the edge how much work to let in at all, rather than accepting everything and failing in the middle where you have already paid for it. Both need the priority ordering agreed with the business before the incident, because nobody makes that call well at 3am.",
    topicIds: [
      "reliability.load-shedding",
      "messaging.backpressure",
      "reliability.graceful-degradation",
    ],
    tier: 1,
    speed: [
      {
        question:
          "Why is queueing worse than shedding under sustained overload?",
        correct:
          "Latency grows without bound and you serve answers callers have already given up on",
        distractors: [
          "Queues consume memory, which eventually crashes the process",
          "Queued requests lose their ordering guarantees",
          "It is not worse — queueing preserves work that shedding throws away",
        ],
      },
      {
        question: "Which traffic should you shed first?",
        correct: "Retries, before first attempts",
        distractors: [
          "The largest requests, since they cost the most",
          "The oldest requests in the queue",
          "Whichever clients are sending the most traffic",
        ],
      },
    ],
  },
]
