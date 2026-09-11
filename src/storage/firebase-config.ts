/**
 * Firebase configuration.
 *
 * THIS FILE IS THE SWITCH. While `firebaseConfig` is null the app uses
 * LocalProgressStore (browser-only, no account, works offline). Fill it in and
 * the app uses Firestore instead: progress syncs across devices and survives a
 * cleared browser profile.
 *
 * Step-by-step instructions: docs/FIRESTORE_SETUP.md
 *
 * These values are NOT secrets -- Firebase web config is public by design, and
 * access is controlled by security rules, not by hiding the config. They are
 * kept in a file rather than env vars so the demo runs with no setup at all;
 * move them to NEXT_PUBLIC_FIREBASE_* env vars before deploying to Vercel.
 */

export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export const firebaseConfig: FirebaseConfig | null = null

// When you are ready, replace the line above with your own values:
//
// export const firebaseConfig: FirebaseConfig | null = {
//   apiKey: "AIza...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   storageBucket: "your-project.firebasestorage.app",
//   messagingSenderId: "123456789012",
//   appId: "1:123456789012:web:abc123",
// }
