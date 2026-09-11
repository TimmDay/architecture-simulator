import { LocalProgressStore } from "./local"
import { firebaseConfig } from "./firebase-config"
import type { ProgressStore } from "./types"

let cached: ProgressStore | null = null

/**
 * Resolve the progress store.
 *
 * Local until Firebase config is present, then Firestore. This is the entire
 * cost of the swap, which was the point of putting an interface here in the
 * first place.
 */
export function getProgressStore(): ProgressStore {
  if (cached) return cached
  if (firebaseConfig) {
    // Loaded lazily so the `firebase` package is never pulled into the bundle
    // for users running on local storage.
    throw new Error(
      "Firebase config is set but FirestoreProgressStore is not wired yet. " +
        "Run `pnpm add firebase` and follow docs/FIRESTORE_SETUP.md step 6.",
    )
  }
  cached = new LocalProgressStore()
  return cached
}
