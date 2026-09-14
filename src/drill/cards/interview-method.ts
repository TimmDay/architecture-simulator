import type { Card } from "../types"

export const interviewMethodCards: Card[] = [
  {
    id: "interview-requirements",
    prompt:
      "You are given 'design Twitter'. What do you do in the first five minutes, and why does it decide the rest of the hour?",
    answer:
      "Narrow it, out loud, and write the result down. Separate functional requirements — post, follow, view a feed — from non-functional ones, which are the numbers that actually constrain the design: scale, read/write ratio, latency target, availability target, and consistency tolerance. Then explicitly cut: 'I will not cover search, DMs or ads; tell me if you would rather I did.' This decides the hour because every later trade-off is judged against those numbers, and because a design with no stated constraints cannot be evaluated — an interviewer cannot tell whether your answer is good, only that it is an answer.",
    emFraming:
      "The unstated requirement that changes everything is usually the read/write ratio and the shape of the distribution. 'Most accounts have a hundred followers, a few have fifty million' is the single sentence that determines whether fanout-on-write survives, and it is worth asking for directly.",
    topicIds: ["interview.requirements", "interview.method"],
    tier: 1,
    speed: [
      {
        question:
          "What is the most useful thing to establish in the first five minutes?",
        correct:
          "The non-functional numbers — scale, read/write ratio, latency and consistency targets",
        distractors: [
          "The full list of features the product needs",
          "Which database and language you will use",
          "The team structure that will own each service",
        ],
      },
      {
        question: "Why does explicitly cutting scope help you?",
        correct:
          "It makes the design evaluable — an interviewer can judge it against stated constraints",
        distractors: [
          "It saves time for the parts you know best",
          "It shows you can prioritise product features",
          "It prevents the interviewer adding requirements later",
        ],
      },
    ],
  },
  {
    id: "interview-structure",
    prompt: "How should you structure a 45-minute system design interview?",
    answer:
      "Roughly: five minutes on requirements and scope, five on estimation, five sketching the API and data model, ten on a high-level design that works end to end, fifteen on one or two deep dives the interviewer chooses, and five on bottlenecks and what you would do next. The order matters because each stage constrains the next, and because getting something simple working end to end before adding anything is what lets you say 'here is where this breaks, and here is what I would add' rather than presenting a complicated design with no story about why. Narrate throughout — silence is unevaluable.",
    emFraming:
      "The commonest failure is not ignorance but time management: forty minutes on the data model and no working system. The second commonest is designing for a million users when you were told ten thousand, which reads as inability to judge rather than as ambition.",
    topicIds: ["interview.method", "interview.requirements"],
    tier: 1,
    speed: [
      {
        question: "What should you produce before adding any sophistication?",
        correct:
          "A simple design that works end to end, so you can then say where it breaks",
        distractors: [
          "A complete data model with all entities and indexes",
          "A capacity plan for the peak load",
          "A list of every component you might eventually need",
        ],
      },
      {
        question:
          "What is the commonest way candidates fail, given equal knowledge?",
        correct:
          "Time management — no working end-to-end system by the end of the hour",
        distractors: [
          "Choosing the wrong database",
          "Not knowing enough about consensus algorithms",
          "Underestimating the storage requirement",
        ],
      },
    ],
  },
  {
    id: "interview-tradeoffs",
    prompt:
      "What does it mean to 'name the trade-off', and why do interviewers weight it so heavily?",
    answer:
      "Saying what a choice costs, not only what it buys, and being specific: 'a read replica gets me read scaling and costs me read-your-writes unless I route a user's reads to the primary after a write.' Interviewers weight it because a design with no stated costs signals one of two things — that you do not know them, or that you have not considered alternatives — and both predict the same failure on a real team. The pattern that works is: state the option, state what it buys, state what it costs, state the condition under which you would revisit it.",
    emFraming:
      "The strongest version adds the threshold: 'I would not shard yet at this scale, but past roughly this write rate I would, and here is the signal I would watch.' That turns an answer into a plan, and it is what distinguishes someone who has operated a system from someone who has read about one.",
    topicIds: [
      "interview.tradeoffs",
      "interview.method",
      "cost.unit-economics",
    ],
    tier: 1,
    speed: [
      {
        question: "What does a design with no stated costs signal?",
        correct:
          "That you either do not know them or have not considered alternatives",
        distractors: [
          "That the design is simple enough not to need them",
          "That you are confident in the approach",
          "That the requirements were too vague to evaluate against",
        ],
      },
      {
        question: "What turns a trade-off into a plan?",
        correct:
          "Naming the threshold at which you would revisit it, and the signal you would watch",
        distractors: [
          "Listing every alternative you considered and rejected",
          "Quantifying the cost of each option in dollars",
          "Committing to the decision so the design stays coherent",
        ],
      },
    ],
  },
  {
    id: "interview-deep-dive",
    prompt:
      "The interviewer picks one component and starts drilling. How do you handle not knowing something?",
    answer:
      "Say so, then reason from what you do know. 'I have not run Cassandra in production, but it is leaderless with tunable quorums, so I would expect the trade to be write availability against read consistency, and I would check how repair behaves under load.' That is worth far more than a confident wrong answer, which is the single worst outcome because it makes everything else you said unreliable. Deep dives are also where you should volunteer failure modes — what happens when this is down, slow, or partitioned — because that is usually what is being probed.",
    emFraming:
      "An interviewer is partly assessing what you would be like in a design review. Somebody who bluffs is expensive to work with; somebody who says 'I do not know, here is how I would find out' is not. That is a real signal, not interview etiquette.",
    topicIds: [
      "interview.deep-dive",
      "interview.tradeoffs",
      "reliability.failure-domains",
    ],
    tier: 1,
    speed: [
      {
        question:
          "You are asked about something you have not used. What is the best response?",
        correct:
          "Say so, then reason from adjacent knowledge to what you would expect and how you would check",
        distractors: [
          "Give your best guess confidently and move on quickly",
          "Redirect to a technology you do know well",
          "Acknowledge the gap and ask to move to another area",
        ],
      },
      {
        question: "What should you volunteer during a deep dive?",
        correct:
          "Failure modes — what happens when this is down, slow, or partitioned",
        distractors: [
          "Alternative technologies you considered",
          "The cost of running the component at scale",
          "How you would test the component",
        ],
      },
    ],
  },
]
