import type { ArchitectureGraph, Scenario } from "../types"
import { CLIENT_NODE_ID } from "../types"

/**
 * Scenario 1 -- the tutorial.
 *
 * Teaching goal, in one line: **redundancy where it is cheap, backups where it
 * is expensive, and a budget that punishes gold-plating.**
 *
 * The junior answer to every scenario is "add more boxes". This scenario is
 * built so that the correct answer is to add redundancy to the stateless tier
 * (cheap, and required) while explicitly declining to add a read replica
 * (expensive, and buys availability that is already met). The $300 budget is set
 * so that a replica does not fit. That refusal is the lesson.
 *
 * Intended arc, in five beats:
 *   1. Player builds client -> app -> db. Passes baseline comfortably. Feels good.
 *   2. `node-down` fires. One app instance was the whole app tier -> total outage.
 *   3. Player adds a second app server. `topology.no-lb-in-front` fires: two
 *      servers and nothing routing to them.
 *   4. Player adds the LB. If they left sessions in-memory,
 *      `scaling.session-affinity` fires. Stateless tokens fix it for free. Redis
 *      also fixes it -- but a single Redis is a new SPOF on the critical path
 *      (availability drops to 0.9894, under the bar), and an HA pair costs $44
 *      and breaks the budget. "The fix introduced a worse problem" is the point.
 *   5. Player pushes the slider to Outage Day (400 rps). Two app servers is 400
 *      rps of capacity, so losing one during the fault saturates the rest.
 *      N+1 capacity planning: they need four. Then they are tempted by a read
 *      replica, and the budget says no.
 */

export const firstRealCustomers: Scenario = {
  id: "01-first-real-customers",
  title: "First Real Customers",
  family: "monolith",
  level: 1,

  brief: `You run a helpdesk SaaS. Support teams at other companies use it to track
their tickets. You have just signed your 500th customer organisation -- roughly
25,000 end users, all in one country, all on the web app.

Until last month this ran on a single box under someone's desk, and last month
it fell over for four hours during a customer's own outage, which is exactly
when they needed it. Your biggest customer has asked, politely, what your
availability commitment is.

You have $300 a month. Not $3,000. Build something you can defend.`,

  requirements: {
    p99Ms: 500,
    availability: 0.99, // graded only under the fault script
    monthlyBudgetUsd: 300,
    durability: "durable", // a lost ticket is a lost customer
    consistency: "read-your-writes", // file a ticket, you must see it in your list
  },

  // Ascending. The slider spans these; cost and capacity are graded at the last.
  loadProfiles: [
    {
      id: "tuesday-afternoon",
      label: "Tuesday afternoon",
      peakRps: 40,
      readWriteRatio: 9,
      shape: "steady",
      geography: "single-region",
      cacheableReadFraction: 0.3,
    },
    {
      id: "monday-morning",
      label: "Monday morning",
      peakRps: 120,
      readWriteRatio: 8,
      shape: "diurnal",
      geography: "single-region",
      cacheableReadFraction: 0.3,
    },
    {
      id: "outage-day",
      label: "Outage Day (a customer's own systems are down)",
      peakRps: 400,
      readWriteRatio: 5, // everyone is filing, not browsing
      shape: "spiky",
      geography: "single-region",
      cacheableReadFraction: 0.15,
    },
  ],

  // L1 unlocks exactly one fault class. `instances: 1` matters -- this kills one
  // instance, not the component, so a redundant tier genuinely survives it.
  faultScript: [[{ kind: "node-down", componentId: "app", instances: 1 }]],

  // Decoys are deliberate. sql-replica, cache, cdn and api-gateway are all
  // plausible and all wrong-by-default here -- a palette containing only the
  // right answer asks the player to make no decision at all. The gateway is the
  // sharpest of them: it looks like diligence, and in front of a single service
  // it is $33/mo for a job nobody has yet.
  //
  // web-client is NOT a decoy. Every product has one, and its rendering mode is
  // a real architectural decision with real consequences for the app tier.
  availableKinds: [
    "web-client",
    "load-balancer",
    "api-gateway",
    "app-server",
    "sql-primary",
    "sql-replica",
    "cache",
    "cdn",
  ],

  topicIds: [
    "frontend.rendering-strategy",
    "api.gateway-and-bff",
    "reliability.redundancy",
    "reliability.failure-domains",
    "reliability.slo-sli-error-budget",
    "scaling.vertical-vs-horizontal",
    "scaling.statelessness",
    "scaling.session-affinity",
    "load-balancing.health-checks",
    "data-stores.relational-vs-document",
    "cost.unit-economics",
    "cost.right-sizing",
  ],
}

/**
 * The reference solution. This is a test fixture, not something shown to the
 * player -- it pins "there exists a build that passes every requirement", so a
 * catalogue change that quietly makes the scenario unwinnable fails CI.
 *
 * Cost: LB $18 + 4 x app $117 + primary $124 = $259/mo, inside the $300 budget.
 * Adding a read replica takes it to $383 and fails. That is the intended trap.
 */
export const firstRealCustomersReference: ArchitectureGraph = {
  components: [
    {
      id: "lb",
      kind: "load-balancer",
      label: "Public load balancer",
      instances: 1,
      region: "eu-west-1",
      config: { availabilityZones: 2 },
    },
    {
      id: "app",
      kind: "app-server",
      label: "Helpdesk app",
      // Four, not three: at 400 rps peak the tier must still serve peak with one
      // instance gone. 4 x 200 = 800; lose one and 600 remains, rho = 0.67.
      instances: 4,
      region: "eu-west-1",
      config: {
        availabilityZones: 2,
        // Stateless via signed tokens. This is the ONLY answer to session
        // affinity that fits: a shared cache on the critical path either lowers
        // availability below the bar (one instance) or breaks the budget (two).
        sessionStore: "none",
      },
    },
    {
      id: "db",
      kind: "sql-primary",
      label: "Tickets database",
      instances: 1,
      region: "eu-west-1",
      config: {
        availabilityZones: 1,
        consistency: "strong",
        // Durability requirement is met by backups, NOT by a replica. A replica
        // is an availability tool and this scenario's availability bar does not
        // need one.
        backups: { enabled: true, rpoMinutes: 5 },
        encryptedAtRest: true,
      },
    },
  ],

  edges: [
    {
      id: "client-lb",
      from: CLIENT_NODE_ID,
      to: "lb",
      kind: "sync-request",
      carries: "all",
    },
    {
      id: "lb-app",
      from: "lb",
      to: "app",
      kind: "sync-request",
      carries: "all",
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
