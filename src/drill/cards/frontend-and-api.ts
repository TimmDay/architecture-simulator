import type { Card } from "../types"

export const frontendAndApiCards: Card[] = [
  {
    id: "rest-api-design",
    prompt:
      "What makes a REST API well designed? Name the properties that actually matter and say what each one buys you.",
    answer:
      "Resources, not actions: URLs name things (`/orders/42/items`) and the HTTP method says what you are doing to them, so the API is predictable without documentation. Methods carry their standard semantics -- GET is safe and cacheable, PUT and DELETE are idempotent, POST is neither -- because every proxy, CDN and client library already assumes this. Status codes are used honestly, so 404 means absent, 409 means a conflict, 422 means it parsed but was invalid, and a 200 containing an error body breaks every caller's error handling. Responses are stateless, so any instance can serve any request. Collections are paginated by cursor rather than offset, because offsets skip and duplicate rows while the data changes underneath them. Errors have one machine-readable shape across every endpoint. Versioning is explicit, so you can change your mind later. And unsafe operations accept an idempotency key, because clients retry.",
    emFraming:
      'The two failures worth catching in review are RPC wearing REST\'s clothes -- `POST /createOrderAndSendEmail` -- and returning 200 with `{"error": ...}`, which forces every client to parse the body to find out whether it worked. Both are cheap to fix on day one and expensive once there are callers you do not control. Note also that HATEOAS is in the original definition of REST and almost nobody implements it; being able to say that plainly is better than pretending either way.',
    topicIds: [
      "api.rest-design",
      "api.status-codes",
      "api.versioning",
      "api.pagination",
    ],
    tier: 1,
    speed: [
      {
        question: "Which URL is the most RESTful?",
        correct: "POST /orders/42/refunds",
        distractors: [
          "POST /refundOrder?id=42",
          "GET /orders/42/refund?confirm=true",
          "POST /api/order/refund/42/execute",
        ],
      },
      {
        question: "Which HTTP methods must be idempotent?",
        correct: "GET, PUT and DELETE — but not POST",
        distractors: [
          "All of them, once the server deduplicates requests",
          "GET and POST, since both are safe to repeat",
          "Only GET; the rest change state so cannot be idempotent",
        ],
      },
      {
        question:
          "Why is cursor pagination better than offset for a changing collection?",
        correct:
          "Offsets skip and duplicate rows when items are inserted or removed mid-traverse",
        distractors: [
          "Cursors let the client jump directly to any page",
          "Offsets require a full table scan on every page",
          "Cursors guarantee the total count stays accurate",
        ],
      },
      {
        question:
          "An endpoint parses the request fine but the value fails a business rule. Which status?",
        correct: "422 Unprocessable Content",
        distractors: [
          "400 Bad Request",
          "200 OK with an error object in the body",
          "500 Internal Server Error",
        ],
      },
    ],
  },

  {
    id: "rendering-strategies",
    prompt:
      "Static, server-rendered and client-rendered: what does each cost you, and what does each buy?",
    answer:
      "Static pre-renders at build time: near-zero origin load because a CDN serves it, best first paint, but the content is as old as your last build. SSR renders per request: fresh and indexable, but every page view consumes CPU on a server you pay for, so the app tier needs sizing for it. CSR ships a bundle once and then makes API calls: cheapest origin and the lightest backend, but nothing is visible until the bundle downloads and executes, and a crawler that does not run JavaScript sees an empty page.",
    emFraming:
      "The useful reframing for a team argument is that this is a question about where you want to spend: build time, server CPU, or the user's device. Most real apps are a mix per route -- a static marketing page, an SSR product page, a CSR dashboard behind a login -- and insisting on one mode for the whole app is the actual mistake.",
    topicIds: [
      "frontend.rendering-strategy",
      "caching.cdn",
      "caching.edge-caching",
    ],
    tier: 1,
    speed: [
      {
        question:
          "What does server-side rendering cost you that client-side rendering does not?",
        correct: "CPU on a server you pay for, on every page view",
        distractors: [
          "Search engine visibility, because crawlers see an empty page",
          "A larger JavaScript bundle for the user to download",
          "The ability to cache anything at the edge",
        ],
      },
    ],
  },
  {
    id: "client-validation",
    prompt:
      "A team says moving validation into the browser will reduce load on the API. What is wrong with that, and what is client validation actually for?",
    answer:
      "It reduces nothing you can rely on. The browser is an untrusted client -- anyone can open devtools, or skip the page entirely and call the API directly -- so the server has to perform every check regardless, and a malicious or buggy client still costs you the round trip. Client validation is a UX feature: it gives immediate feedback and saves the user a failed submission. It is not a security control and it is not a capacity control.",
    emFraming:
      "The general principle is worth having ready in reviews: any check that lives only where the attacker controls the code is not a check. The same reasoning covers hidden form fields, disabled buttons, and 'the UI doesn't let you do that'.",
    topicIds: [
      "frontend.client-validation",
      "security.zero-trust",
      "security.authn-vs-authz",
    ],
    tier: 1,
    speed: [
      {
        question: "What is client-side validation actually for?",
        correct:
          "Immediate feedback for the user — it is UX, not a security or capacity control",
        distractors: [
          "Reducing load on the API by rejecting bad requests early",
          "Protecting against injection attacks before data reaches the server",
          "Enforcing business rules consistently across web and mobile",
        ],
      },
    ],
  },
  {
    id: "client-retry-behaviour",
    prompt:
      "Why is 'retry immediately on failure' in a web client more dangerous than the same logic in a server-side job?",
    answer:
      "Scale and synchronisation. There may be tens of thousands of browsers, and they all observe the same backend failure at the same instant, so their retries arrive as a synchronised wave rather than a spread. That wave lands precisely when the backend is least able to absorb it, converting a brief blip into a sustained outage. Servers retrying are fewer, usually already rate-limited, and easier to coordinate.",
    emFraming:
      "Jitter is the part people drop, and it is the part that does the work -- backoff alone still lets the crowd move in lockstep. Worth asking what your client does on a 503 today; most teams do not know.",
    topicIds: [
      "frontend.client-resilience",
      "reliability.retries-and-jitter",
      "messaging.backpressure",
    ],
    tier: 2,
    speed: [
      {
        question:
          "Why is 'retry immediately' more dangerous in a browser than in a server-side job?",
        correct:
          "Thousands of clients see the same failure at the same instant and retry in lockstep",
        distractors: [
          "Browsers cannot implement exponential backoff reliably",
          "Client retries bypass the load balancer's rate limiting",
          "Mobile networks duplicate requests, multiplying the effect",
        ],
      },
    ],
  },
  {
    id: "gateway-vs-load-balancer",
    prompt:
      "What is the difference between a load balancer and an API gateway, and when do you need both?",
    answer:
      "A load balancer distributes traffic across instances of one service and removes unhealthy ones from rotation; it knows nothing about your API. A gateway is one front door in front of many services: it routes by path or host, authenticates, enforces per-client rate limits and quotas, and can transform requests. You need both once you have several services behind a single public surface -- the gateway decides which service, the load balancer decides which instance of it. With one service, the gateway is only worth its cost if you specifically want its auth or rate-limiting.",
    emFraming:
      "Watch for the gateway becoming a dumping ground for business logic. Once routing rules encode product behaviour, you have a distributed monolith with a config file at its centre and no tests around it.",
    topicIds: [
      "api.gateway-and-bff",
      "load-balancing.l4-vs-l7",
      "security.rate-limiting",
    ],
    tier: 1,
    speed: [
      {
        question: "What does an API gateway do that a load balancer does not?",
        correct:
          "Routes between many services, and handles auth, quotas and per-client rate limits",
        distractors: [
          "Spreads traffic across instances and removes unhealthy ones",
          "Terminates TLS and handles certificate rotation",
          "Caches responses at the edge, closer to users",
        ],
      },
    ],
  },
  {
    id: "bff-pattern",
    prompt:
      "What problem does a Backend-for-Frontend solve, and what does it cost?",
    answer:
      "A shared general-purpose API ends up serving several clients with genuinely different needs -- a web app wants a wide payload in one call, a mobile app wants a small one over a slow network -- and satisfying all of them makes it either chatty or bloated. A BFF gives each client its own tailored aggregation layer, owned by the team that owns that client. It costs you another deployable per client, duplicated logic across BFFs, and one more hop of latency.",
    emFraming:
      "This is a Conway's Law decision as much as a technical one: a BFF works when the client team owns it, and becomes a bottleneck the moment a separate backend team is asked to maintain three of them.",
    topicIds: ["api.gateway-and-bff", "org.conways-law", "api.n-plus-one"],
    tier: 2,
    speed: [
      {
        question: "What does a Backend-for-Frontend cost you?",
        correct:
          "Another deployable per client, duplicated logic, and one more hop of latency",
        distractors: [
          "Strong coupling between the web and mobile release cycles",
          "The ability to version your public API independently",
          "Consistency, since each BFF reads from a different database",
        ],
      },
    ],
  },
  {
    id: "bundle-and-cache-headers",
    prompt:
      "Why are hashed filenames plus long cache lifetimes the standard way to ship frontend assets?",
    answer:
      "They separate the two things you want: assets that never need revalidating, and deploys that take effect immediately. Content-hashed filenames mean a given URL's contents can never change, so it can be cached effectively forever at the CDN and in the browser. The HTML that references them stays uncached or briefly cached, so a deploy simply points at new filenames and every client picks them up on the next page load, with no invalidation to orchestrate.",
    emFraming:
      "The failure mode to recognise is caching the HTML aggressively too: users then sit on a stale page referencing assets that still exist, and you get bug reports that reproduce for nobody.",
    topicIds: [
      "frontend.bundle-and-caching",
      "caching.invalidation",
      "caching.ttl-and-staleness",
    ],
    tier: 2,
    speed: [
      {
        question: "Why hash asset filenames and cache them for a year?",
        correct:
          "A given URL's contents can never change, so it needs no revalidation and deploys need no invalidation",
        distractors: [
          "It lets the CDN compress assets more aggressively",
          "Browsers refuse to cache files without a content hash",
          "It prevents users loading assets from a stale service worker",
        ],
      },
    ],
  },
]
