import type { CardState } from "~/drill/types"
import type {
  ProgressSnapshot,
  ProgressStore,
  SavedGraph,
  ScenarioAttempt,
} from "./types"

const KEY = "architecture-simulator:progress:v1"

type Blob = {
  cardStates: Record<string, CardState>
  attempts: ScenarioAttempt[]
  graphs: Record<string, SavedGraph>
}

const EMPTY: Blob = { cardStates: {}, attempts: [], graphs: {} }

/**
 * Browser-local progress. Zero configuration, zero account, works offline.
 *
 * The deliberate limitation: progress lives in one browser profile on one
 * machine. Export/import exists so that is survivable, and swapping to
 * FirestoreProgressStore removes the limitation entirely.
 *
 * Every read and write is wrapped -- storage throws in private windows and when
 * site data is blocked, and a study app that white-screens because it could not
 * remember a scheduling interval is worse than one that forgets.
 */
export class LocalProgressStore implements ProgressStore {
  readonly name = "local"

  private read(): Blob {
    if (typeof window === "undefined") return EMPTY
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return EMPTY
      return { ...EMPTY, ...(JSON.parse(raw) as Partial<Blob>) }
    } catch {
      return EMPTY
    }
  }

  private write(blob: Blob): void {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(KEY, JSON.stringify(blob))
    } catch {
      // Quota or blocked storage. The session continues with in-memory state.
    }
  }

  async getCardStates(): Promise<CardState[]> {
    return Object.values(this.read().cardStates)
  }

  async saveCardState(state: CardState): Promise<void> {
    const blob = this.read()
    blob.cardStates[state.cardId] = state
    this.write(blob)
  }

  async saveCardStates(states: CardState[]): Promise<void> {
    const blob = this.read()
    for (const s of states) blob.cardStates[s.cardId] = s
    this.write(blob)
  }

  async getAttempts(scenarioId?: string): Promise<ScenarioAttempt[]> {
    const all = this.read().attempts
    return scenarioId ? all.filter((a) => a.scenarioId === scenarioId) : all
  }

  async saveAttempt(attempt: ScenarioAttempt): Promise<void> {
    const blob = this.read()
    blob.attempts = [attempt, ...blob.attempts].slice(0, 200)
    this.write(blob)
  }

  async getSavedGraphs(scenarioId?: string): Promise<SavedGraph[]> {
    const all = Object.values(this.read().graphs)
    return scenarioId ? all.filter((g) => g.scenarioId === scenarioId) : all
  }

  async saveGraph(graph: SavedGraph): Promise<void> {
    const blob = this.read()
    blob.graphs[graph.id] = graph
    this.write(blob)
  }

  async exportAll(): Promise<ProgressSnapshot> {
    const blob = this.read()
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      cardStates: Object.values(blob.cardStates),
      attempts: blob.attempts,
      graphs: Object.values(blob.graphs),
    }
  }

  async importAll(snapshot: ProgressSnapshot): Promise<void> {
    const blob: Blob = {
      cardStates: Object.fromEntries(
        snapshot.cardStates.map((s) => [s.cardId, s]),
      ),
      attempts: snapshot.attempts ?? [],
      graphs: Object.fromEntries((snapshot.graphs ?? []).map((g) => [g.id, g])),
    }
    this.write(blob)
  }
}
