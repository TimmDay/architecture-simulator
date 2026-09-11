// THROWAWAY. This is NOT the simulator.
//
// A one-off harness used to check that scenario 1 is winnable before committing
// to its numbers. It reimplements rho, the latency heuristic, the availability
// product and the cost model independently of src/sim/ -- which makes it a
// second model that will drift the moment simulate() exists.
//
// It lives in docs/ as a record of how the scenario-1 figures were derived, and
// is superseded in Phase 3 by a vitest test that asserts the same claim against
// the real simulate(). Do not import it; do not fix bugs in it.

const HOURS = 730
const SPECS = {
  lb:      { r: 10000, w: 10000, p99: 8,  a: 0.9995, $: 0.025 },
  app:     { r: 200,   w: 200,   p99: 80, a: 0.99,   $: 0.04  },
  db:      { r: 2000,  w: 400,   p99: 25, a: 0.995,  $: 0.17  },
  replica: { r: 2000,  w: 0,     p99: 25, a: 0.995,  $: 0.17  },
  cache:   { r: 50000, w: 50000, p99: 3,  a: 0.995,  $: 0.03  },
}
const LATENCY_CAP = 20 // clamp on the 1/(1-rho) heuristic

function evaluate(name, tiers, rps, rwRatio, kill = {}) {
  const reads = rps * rwRatio / (rwRatio + 1)
  const writes = rps / (rwRatio + 1)
  let p99 = 0, avail = 1, cost = 0, saturated = []
  for (const t of tiers) {
    const s = SPECS[t.spec]
    const alive = Math.max(0, t.n - (kill[t.id] ?? 0))
    cost += s.$ * HOURS * t.n
    if (alive === 0) { avail = 0; saturated.push(`${t.id}: DEAD`); continue }
    const myWrites = t.readsOnly ? 0 : writes
    const rhoR = reads / (s.r * alive)
    const rhoW = s.w === 0 ? (myWrites > 0 ? Infinity : 0) : myWrites / (s.w * alive)
    const rho = Math.max(rhoR, rhoW)
    if (rho >= 1) { saturated.push(`${t.id}: rho=${rho.toFixed(2)} SATURATED`); p99 += s.p99 * LATENCY_CAP }
    else p99 += s.p99 * Math.min(1 / (1 - rho), LATENCY_CAP)
    // failure domains: instances spread round-robin over zones
    const domains = Math.min(alive, t.az ?? 1)
    avail *= 1 - Math.pow(1 - s.a, domains)
  }
  return { name, p99: Math.round(p99), avail, cost: Math.round(cost), saturated }
}

const REFERENCE = [
  { id: "lb",  spec: "lb",  n: 1, az: 2 },
  { id: "app", spec: "app", n: 4, az: 2 },
  { id: "db",  spec: "db",  n: 1, az: 1 },
]
const NAIVE = [
  { id: "app", spec: "app", n: 1, az: 1 },
  { id: "db",  spec: "db",  n: 1, az: 1 },
]
const THREE_APP = [
  { id: "lb",  spec: "lb",  n: 1, az: 2 },
  { id: "app", spec: "app", n: 3, az: 2 },
  { id: "db",  spec: "db",  n: 1, az: 1 },
]
// replica wired to carry READS only -- the write path stays on the primary
const GOLD = [...REFERENCE, { id: "replica", spec: "replica", n: 1, az: 1, readsOnly: true }]
const REDIS_1AZ = [...REFERENCE, { id: "cache", spec: "cache", n: 1, az: 1 }]
const REDIS_2AZ = [...REFERENCE, { id: "cache", spec: "cache", n: 1, az: 2 }]

const PEAK = [400, 5], BASE = [40, 9]
const REQ = { p99: 500, avail: 0.99, budget: 300 }

const rows = [
  evaluate("naive @ baseline",            NAIVE,     ...BASE),
  evaluate("naive @ peak",                NAIVE,     ...PEAK),
  evaluate("naive @ peak + node-down",    NAIVE,     ...PEAK, { app: 1 }),
  evaluate("3 apps @ peak + node-down",   THREE_APP, ...PEAK, { app: 1 }),
  evaluate("REFERENCE @ baseline",        REFERENCE, ...BASE),
  evaluate("REFERENCE @ peak",            REFERENCE, ...PEAK),
  evaluate("REFERENCE @ peak + node-down",REFERENCE, ...PEAK, { app: 1 }),
  evaluate("+redis 1az @ peak+node-down", REDIS_1AZ, ...PEAK, { app: 1 }),
  evaluate("+redis 2az @ peak+node-down", REDIS_2AZ, ...PEAK, { app: 1 }),
  evaluate("+replica @ peak + node-down", GOLD,      ...PEAK, { app: 1 }),
]

console.log("build".padEnd(30), "p99".padStart(6), "avail".padStart(9), "cost".padStart(7), " verdict")
console.log("-".repeat(78))
for (const r of rows) {
  const fails = []
  if (r.p99 > REQ.p99) fails.push("p99")
  if (r.cost > REQ.budget) fails.push("budget")
  if (r.name.includes("node-down") && r.avail < REQ.avail) fails.push("avail")
  if (r.saturated.length) fails.push("saturated")
  console.log(
    r.name.padEnd(30),
    String(r.p99).padStart(6),
    r.avail.toFixed(5).padStart(9),
    ("$" + r.cost).padStart(7),
    " " + (fails.length ? "FAIL: " + fails.join(",") : "PASS"),
    r.saturated.length ? " [" + r.saturated.join("; ") + "]" : ""
  )
}
