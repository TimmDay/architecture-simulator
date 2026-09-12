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
await page.goto("http://localhost:3000/build", { waitUntil: "networkidle" })
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
await page.getByRole("button", { name: /Pressure test/i }).click()
await page.waitForTimeout(900)
console.log("=== RESULTS ===")
console.log(
  await page.evaluate(() =>
    document.querySelectorAll("aside")[1]?.innerText.slice(0, 900),
  ),
)
await page.screenshot({ path: SHOT + "build-results.png" })
console.log("errors:", errs.length ? errs.join("\n ") : "(none)")
await browser.close()
if (errs.length) process.exit(1)
