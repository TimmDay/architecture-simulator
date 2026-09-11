import type { Card } from "../types"

export const reliabilityCards: Card[] = [
  {
    id: "slo-error-budget",
    prompt: "What is an error budget, and what is it for organisationally?",
    answer:
      "The allowed unreliability implied by an SLO: a 99.9% availability target over 30 days permits ~43 minutes of failure. The budget is a shared, quantified permission to take risk -- while there is budget left, ship; once it is spent, reliability work takes priority over features.",
    emFraming:
      "This is the actual point of SLOs and the part managers skip. Without an error budget, 'how reliable should this be?' is settled by whoever argues hardest. With one, it is settled by arithmetic agreed in advance. If nothing changes when the budget is exhausted, you do not have an SLO, you have a dashboard.",
    topicIds: ["reliability.slo-sli-error-budget"],
    tier: 1,
  },
  {
    id: "failure-domain",
    prompt:
      "Three instances of a service are running, so it is redundant. What question determines whether that is true?",
    answer:
      "What do they share? Redundancy only buys availability across independent failure domains. Three instances on one host, in one rack, in one AZ, or behind one power supply fail together -- the availability maths (1 - p^n) assumes independence, and without it three instances are one instance with extra cost.",
    emFraming:
      "Generalise the question: shared control plane, shared deploy pipeline, shared config service, shared certificate expiry. Correlated failure is what turns an outage into a long outage, and it is almost never on the architecture diagram.",
    topicIds: ["reliability.failure-domains", "reliability.redundancy"],
    tier: 1,
  },
  {
    id: "n-plus-one-capacity",
    prompt:
      "Your service peaks at 400 rps and each instance handles 200 rps. How many instances do you run, and why?",
    answer:
      "At least three, and realistically four. Two exactly meets peak with zero headroom, so losing one instance during peak -- a deploy, a crash, an AZ blip -- leaves 200 rps of capacity against 400 rps of load, and the tier collapses. You size so that peak is still served with one instance gone (N+1), plus headroom because utilization near 100% makes latency explode well before requests start failing.",
    emFraming:
      "N+1 capacity planning is the specific reason 'we're only at 50% CPU' is not the reassurance people think it is. At 50% across two instances you are one failure from 100%.",
    topicIds: [
      "reliability.redundancy",
      "scaling.vertical-vs-horizontal",
      "fundamentals.throughput-vs-latency",
    ],
    tier: 1,
  },
  {
    id: "retry-storm",
    prompt:
      "Why can adding retries make an outage worse, and what makes them safe?",
    answer:
      "A struggling dependency gets more load precisely when it can least handle it -- each client retry multiplies offered load, turning a brownout into a collapse, and synchronised retries arrive in waves. Safe retries need: exponential backoff, jitter to desynchronise, a retry budget (cap retries as a fraction of total requests), idempotent operations, and a circuit breaker to stop retrying a dependency that is clearly down.",
    emFraming:
      "Retries are the most common example of a local fix with global consequences. Every client team adds them reasonably; the aggregate is a DDoS you built yourself.",
    topicIds: ["reliability.retries-and-jitter", "reliability.circuit-breaker"],
    tier: 1,
  },
  {
    id: "circuit-breaker",
    prompt: "What does a circuit breaker do that a timeout does not?",
    answer:
      "A timeout bounds one request; a circuit breaker bounds the aggregate. After a failure threshold it stops sending requests to a failing dependency at all, failing fast for a cooldown before letting a trial request through. This stops you spending your own threads and connections waiting on something that is down, which is how one sick dependency takes out a healthy caller.",
    emFraming:
      "The failure mode it prevents is resource exhaustion propagating upstream -- every thread parked on a 30s timeout means no threads left for requests that would have succeeded. Pair with a bulkhead so one dependency cannot consume the whole pool.",
    topicIds: ["reliability.circuit-breaker", "reliability.bulkheads"],
    tier: 2,
  },
  {
    id: "graceful-degradation",
    prompt:
      "Give a concrete example of graceful degradation, and say what makes it a design decision rather than an accident.",
    answer:
      "An e-commerce page where the recommendations service is down: the page renders with the product, price and buy button, omitting the 'you might also like' strip, rather than returning a 500. It is a design decision because someone had to decide in advance which parts of the response are essential and which are optional, and the code had to be written to lose the optional parts independently.",
    emFraming:
      "The management version of this question: which of your dependencies are on the critical path for revenue, and does your code know the difference? Most systems treat all dependencies as mandatory by default, which means the least important one sets your availability ceiling.",
    topicIds: ["reliability.graceful-degradation", "reliability.bulkheads"],
    tier: 2,
  },
]
