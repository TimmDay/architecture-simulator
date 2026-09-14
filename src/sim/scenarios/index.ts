import type { Scenario } from "../types"
import { firstRealCustomers } from "./01-first-real-customers"
import { frontPage } from "./02-front-page"
import { receiptsAndPayments } from "./03-receipts-and-payments"
import { renderQueue } from "./04-render-queue"
import { everythingDownstream } from "./05-everything-downstream"
import { aBillionDesigns } from "./06-a-billion-designs"
import { theViralDeck } from "./07-the-viral-deck"

/** Ordered by level: each one assumes the lessons of the last. */
export const SCENARIOS: Scenario[] = [
  firstRealCustomers,
  frontPage,
  receiptsAndPayments,
  renderQueue,
  everythingDownstream,
  aBillionDesigns,
  theViralDeck,
]

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
