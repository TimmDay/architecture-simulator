import type { Scenario } from "../types"
import { firstRealCustomers } from "./01-first-real-customers"

export const SCENARIOS: Scenario[] = [firstRealCustomers]

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
