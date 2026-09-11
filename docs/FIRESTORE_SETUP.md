# Moving progress into Firestore

The app runs with **no setup at all** out of the box: progress is kept in browser
local storage by `LocalProgressStore`. That works offline and needs no account,
but it lives in one browser profile on one machine — clear your site data and the
deck's review history goes with it, and your laptop and your tablet keep separate
decks.

Firestore fixes both. Its SDK keeps an offline cache, so you keep the local-first
behaviour *and* get cross-device sync. This is a ~20 minute job, all in a browser
except the last two steps.

## What you are creating

```
users/{uid}/cardStates/{cardId}    SM-2 scheduling state, one doc per card
users/{uid}/attempts/{attemptId}   one per scenario run
users/{uid}/graphs/{graphId}       saved architectures
```

Everything sits under your own user document, so the security rule is one line
and no data is ever shared between users.

## Steps

### 1. Create the Firebase project

Go to <https://console.firebase.google.com> and click **Add project**. Name it
`architecture-simulator`. **Turn Google Analytics off** — it adds a consent
banner and a second SDK for no benefit here.

### 2. Create the Firestore database

In the left sidebar: **Build → Firestore Database → Create database**.

- Choose **Production mode** (not test mode — test mode leaves the database world-readable for 30 days).
- Pick the location closest to you, e.g. `europe-west2` for London. **This cannot be changed later.**

### 3. Turn on anonymous auth

**Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**

This gives every browser a stable user ID with no login screen. You can link a
Google account later and keep the same ID and all its history.

### 4. Set the security rules

**Firestore Database → Rules**, replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Click **Publish**. This says: you can read and write your own subtree, and
nothing else. Without it your data is either public or unreachable.

### 5. Get the config values

**Project settings** (the gear, top left) **→ General →** scroll to **Your apps →**
click the web icon `</>`. Register the app as `architecture-simulator-web`. Do
**not** check "Also set up Firebase Hosting" — Vercel is doing that.

You will be shown a `firebaseConfig` object. Copy those six values into
`src/storage/firebase-config.ts`, replacing the `null`.

These values are not secrets — Firebase web config is public by design, and step 4
is what actually protects the data.

### 6. Install the SDK and wire the store

```bash
pnpm add firebase
```

Then tell me it's done and I'll write `FirestoreProgressStore` against the real
config — it implements the same `ProgressStore` interface, so nothing above it
changes. `getProgressStore()` in `src/storage/index.ts` currently throws a clear
error if config is present but the store isn't wired, so you cannot half-migrate
by accident.

### 7. Before deploying to Vercel

Move the six values out of the file and into `NEXT_PUBLIC_FIREBASE_*` environment
variables in the Vercel dashboard, and read them via `src/env.js`. The file-based
config exists so the local demo needs no setup; it is not how a deployed app
should be configured.

## Cost

Well inside the free tier (50,000 document reads/day). The deck is fetched as one
collection query per session — around 200 reads — and writes one small document
per graded card. To stay there, never fetch cards one document at a time.
