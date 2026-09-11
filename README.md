# architecture-simulator

A personal tool for learning computer-science system architecture to a senior engineering
manager level.

Two modes sharing one topic taxonomy:

- **Drill** — typed-answer flashcards with SM-2 spaced repetition.
- **Build** — a diagramming game: construct an architecture for a scenario, then watch it get
  pressure-tested with traffic, faults and security probes.

Fail a rule in Build and the matching flashcards land in tomorrow's Drill queue.

**The plan lives in [`SPEC.md`](./SPEC.md).** Read that first — nothing is implemented yet.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · TanStack Query ·
zod + react-hook-form · `@xyflow/react` · Cloud Firestore · vitest · pnpm. Deployed on Vercel.
