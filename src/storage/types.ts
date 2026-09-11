import type { CardState } from "~/drill/types"
import type { ArchitectureGraph } from "~/sim/types"

export type ScenarioAttempt = {
  id: string
  scenarioId: string
  at: string
  passed: boolean
  grade: string
  requirementResults: {
    name: string
    passed: boolean
    actual: string
    required: string
  }[]
  failedRuleIds: string[]
}

export type SavedGraph = {
  id: string
  scenarioId: string
  label: string
  updatedAt: string
  graph: ArchitectureGraph
}

export type ProgressSnapshot = {
  version: 1
  exportedAt: string
  cardStates: CardState[]
  attempts: ScenarioAttempt[]
  graphs: SavedGraph[]
}

/**
 * The seam between the app and wherever progress lives.
 *
 * Nothing above this interface knows which implementation is in use. Today the
 * demo runs on `LocalProgressStore` (browser storage, no account, no config).
 * `FirestoreProgressStore` implements the same interface and is switched on by
 * providing Firebase config -- see docs/FIRESTORE_SETUP.md.
 */
export interface ProgressStore {
  readonly name: string
  getCardStates(): Promise<CardState[]>
  saveCardState(state: CardState): Promise<void>
  saveCardStates(states: CardState[]): Promise<void>
  getAttempts(scenarioId?: string): Promise<ScenarioAttempt[]>
  saveAttempt(attempt: ScenarioAttempt): Promise<void>
  getSavedGraphs(scenarioId?: string): Promise<SavedGraph[]>
  saveGraph(graph: SavedGraph): Promise<void>
  exportAll(): Promise<ProgressSnapshot>
  importAll(snapshot: ProgressSnapshot): Promise<void>
}
