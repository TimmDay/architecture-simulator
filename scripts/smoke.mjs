/**
 * Browser smoke test. Not part of `pnpm check` -- it needs a dev server running.
 *
 *   pnpm dev          # in one terminal
 *   pnpm smoke        # in another
 *
 * This exists because the component tests run in happy-dom, which cannot catch
 * the things that actually broke: a stale .next cache serving an empty
 * stylesheet, a canvas with no height, or drag-and-drop that never fires. It
 * drives the real drag, the real wiring and the real pressure test in Chromium,
 * and fails loudly if any of them stop working.
 */
import { chromium } from "playwright"

const SHOT = process.env.SMOKE_OUT ?? "./"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } })
const errs = []
page.on("pageerror", (e) => errs.push(String(e).slice(0, 300)))
await page.goto("http://localhost:3000/build/01-first-real-customers", {
  waitUntil: "networkidle",
})
await page.waitForTimeout(1200)

async function drop(label, x, y) {
  await page.evaluate(
    ({ label, x, y }) => {
      const item = [...document.querySelectorAll("[draggable=true]")].find(
        (el) => el.textContent?.includes(label),
      )
      const pane = document.querySelector(".react-flow__pane")
      const dt = new DataTransfer()
      item.dispatchEvent(
        new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }),
      )
      pane.dispatchEvent(
        new DragEvent("dragover", {
          dataTransfer: dt,
          bubbles: true,
          clientX: x,
          clientY: y,
        }),
      )
      pane.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer: dt,
          bubbles: true,
          clientX: x,
          clientY: y,
        }),
      )
    },
    { label, x, y },
  )
  await page.waitForTimeout(300)
}
async function connect(a, b) {
  const box = await page.evaluate(
    ({ a, b }) => {
      const n = [...document.querySelectorAll(".react-flow__node")]
      const s = n[a].querySelector(".react-flow__handle-right"),
        t = n[b].querySelector(".react-flow__handle-left")
      const p = s.getBoundingClientRect(),
        q = t.getBoundingClientRect()
      return {
        x1: p.x + p.width / 2,
        y1: p.y + p.height / 2,
        x2: q.x + q.width / 2,
        y2: q.y + q.height / 2,
      }
    },
    { a, b },
  )
  await page.mouse.move(box.x1, box.y1)
  await page.mouse.down()
  await page.mouse.move(box.x2, box.y2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(250)
}

await drop("Load balancer", 520, 400)
await drop("App server", 760, 400)
await drop("SQL primary", 1000, 400)
await connect(0, 1)
await connect(1, 2)
await connect(2, 3)
await page.getByRole("button", { name: /Pressure/i }).click()
await page.waitForTimeout(900)
console.log("=== RESULTS ===")
console.log(
  await page.evaluate(() =>
    document.querySelectorAll("aside")[1]?.innerText.slice(0, 900),
  ),
)
await page.screenshot({ path: SHOT + "build-results.png" })
// Fan-out: a router must divide traffic, not clone it.
await drop("App server", 760, 620)
await connect(1, 4)
const split = await page.evaluate(() =>
  [...document.querySelectorAll(".react-flow__node")]
    .map((n) => n.textContent ?? "")
    .filter((t) => t.includes("utilised")),
)
console.log("utilisation after fanning the LB to a second app server:")
split.forEach((t) => console.log("   ", t.replace(/\s+/g, " ").slice(0, 46)))

// Raising instances must pile up cards, so redundancy is visible at a glance.
await page.evaluate(() => {
  const n = [...document.querySelectorAll(".react-flow__node")][2]
  const r = n.getBoundingClientRect()
  n.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      clientX: r.x + 20,
      clientY: r.y + 14,
    }),
  )
})
await page.waitForTimeout(350)
await page.locator('aside input[type="number"]').first().fill("4")
await page.waitForTimeout(400)
const layers = await page.evaluate(
  () =>
    [...document.querySelectorAll(".react-flow__node")][2]?.querySelectorAll(
      "div[aria-hidden]",
    ).length ?? 0,
)
console.log("cards stacked behind a 4-instance tier:", layers, "(expect 3)")
if (layers !== 3) errs.push(`instance stack drew ${layers} cards, expected 3`)
await page.mouse.click(1000, 800)
await page.waitForTimeout(300)

// Moving a component to another provider must show up as egress, immediately.
await page.evaluate(() => {
  const n = [...document.querySelectorAll(".react-flow__node")][3]
  const r = n.getBoundingClientRect()
  n.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      clientX: r.x + 20,
      clientY: r.y + 14,
    }),
  )
})
await page.waitForTimeout(400)
const costOf = () =>
  page.evaluate(
    () =>
      +(
        document.body.innerText.match(/cost\/mo at peak\s+\$([\d,]+)/)?.[1] ??
        "0"
      ).replace(/,/g, ""),
  )
const sameVendor = await costOf()
await page
  .selectOption("aside select", { label: "Google Cloud SQL" })
  .catch(() => {})
await page.waitForTimeout(500)
const crossVendor = await costOf()
console.log(
  `cost all one provider: $${sameVendor} -> database elsewhere: $${crossVendor}`,
)
if (crossVendor <= sameVendor)
  errs.push("moving a component across providers added no egress cost")
await page.mouse.click(700, 820)
await page.waitForTimeout(300)

// Selecting a line must open its config panel.
await page.mouse.click(
  ...(await page.evaluate(() => {
    const e = [...document.querySelectorAll(".react-flow__edge")].at(-1)
    const p = e.querySelector(".react-flow__edge-interaction")
    const q = p.getPointAtLength(p.getTotalLength() / 2)
    const m = p.getScreenCTM()
    return [q.x * m.a + q.y * m.c + m.e, q.x * m.b + q.y * m.d + m.f]
  })),
)
await page.waitForTimeout(500)
const railText = await page.evaluate(
  () => document.querySelectorAll("aside")[1]?.innerText ?? "",
)
console.log(
  "line click opens connection panel:",
  railText.includes("CONNECTION"),
)
if (!railText.includes("CONNECTION"))
  errs.push("clicking an edge did not open the edge panel")

// Reset must clear the board back to the traffic source alone.
await page.getByRole("button", { name: /Reset scenario/i }).click()
await page.waitForTimeout(500)
const after = await page.evaluate(() => ({
  nodes: document.querySelectorAll(".react-flow__node").length,
  edges: document.querySelectorAll(".react-flow__edge").length,
}))
console.log("after reset:", JSON.stringify(after))
if (after.nodes !== 1 || after.edges !== 0)
  errs.push("reset did not clear the board")

// "See a solution" must load a build that actually passes, and must give the
// player their own work back afterwards.
const beforeSolution = await page.evaluate(
  () => document.querySelectorAll(".react-flow__node").length,
)
await page.getByRole("button", { name: /See a solution/i }).click()
await page.waitForTimeout(1200)
await page.getByRole("button", { name: /Pressure/i }).click()
await page.waitForTimeout(900)
const solutionGrade = await page.evaluate(
  () =>
    (document.querySelectorAll("aside")[1]?.innerText ?? "").match(
      /RESULT\s*\n\s*([A-F])/,
    )?.[1] ?? "?",
)
console.log("shown solution grades:", solutionGrade)
if (!["A", "B"].includes(solutionGrade)) {
  errs.push(`the solution shown to the player graded ${solutionGrade}`)
}
await page
  .getByRole("button", { name: /Back to my design/i })
  .first()
  .click()
await page.waitForTimeout(800)
const restored = await page.evaluate(
  () => document.querySelectorAll(".react-flow__node").length,
)
console.log(`board restored: ${restored} nodes (was ${beforeSolution})`)
if (restored !== beforeSolution)
  errs.push("going back did not restore the player's own design")

// The right rail starts closed for canvas width, and must open itself when it
// has something to say -- otherwise selecting a component looks broken.
await page.reload({ waitUntil: "networkidle" })
await page.waitForTimeout(1200)
const railShut = await page.evaluate(() => {
  // innerText still reports text from a display:none element, so ask whether
  // the panel is actually laid out rather than what it contains.
  const aside = document.querySelectorAll("aside")[1]
  const hidden = !aside || aside.offsetParent === null
  const reopenButton = [...document.querySelectorAll("button")].some(
    (b) => b.getAttribute("aria-label") === "Show panel",
  )
  return hidden && reopenButton
})
console.log("right rail closed on load:", railShut)
if (!railShut) errs.push("the right rail did not start closed")

const probeRow = await page.evaluate(() => {
  const tops = ["Pressure", "Security", "Observability"].map((n) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      x.textContent?.trim().startsWith(n),
    )
    return b ? Math.round(b.getBoundingClientRect().top) : -1
  })
  return new Set(tops).size === 1
})
console.log("probe buttons share a row:", probeRow)
if (!probeRow) errs.push("the probe buttons were split across rows")

await page.getByRole("button", { name: /Pressure/i }).click()
await page.waitForTimeout(900)
const openedForResult = await page.evaluate(() =>
  (document.querySelectorAll("aside")[1]?.innerText ?? "").includes("RESULT"),
)
console.log("rail opened to show the result:", openedForResult)
if (!openedForResult) errs.push("the rail stayed shut when a result arrived")

console.log("errors:", errs.length ? errs.join("\n ") : "(none)")
await browser.close()
if (errs.length) process.exit(1)
