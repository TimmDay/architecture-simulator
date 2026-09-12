import type { Scenario } from "../types"
import { firstRealCustomers } from "./01-first-real-customers"
import { frontPage } from "./02-front-page"
import { receiptsAndPayments } from "./03-receipts-and-payments"

/** Ordered by level: each one assumes the lessons of the last. */
export const SCENARIOS: Scenario[] = [
  firstRealCustomers,
  frontPage,
  receiptsAndPayments,
]

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
