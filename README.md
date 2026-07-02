# Vocabulary

A personal vocabulary-learning PWA: save English words into folders, review them as flashcards on an FSRS spaced-repetition schedule, look up definitions (with Russian → English translation), and track streaks and accuracy.

Built with Next.js (App Router), TypeScript, Tailwind CSS + shadcn/ui (Base UI), Drizzle ORM, Postgres, Auth.js, and Serwist. See `TECH_STACK.md` for the full stack rationale and `FUNCTIONALITY.md` for the behavior spec.

## Sections

- **Vocabulary** — folders of words with dictionary auto-fill (pick a sense, edit before saving), duplicate detection, inflected word forms, and search across all folders.
- **Cards** — flashcard review with FSRS scheduling (Again/Hard/Good/Easy), intra-day learning steps, swipe gestures, keyboard shortcuts, undo, and per-folder due counts.
- **Translate** — English or Russian input → English definition (MyMemory + Free Dictionary API/Datamuse), with "add to folder".
- **Stats** — streak, 30-day review trend, per-folder accuracy, all in your local timezone.

## Getting started

Requirements: Node 20+, Docker (for the local Postgres).

```bash
docker compose up -d          # local Postgres on port 5433
cp .env.example .env.local    # then set AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:migrate            # apply Drizzle migrations
npm run dev
```

Open http://localhost:3000, sign up, and start adding words.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Runs migrations, then `next build --webpack` (Serwist needs webpack) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` changes |
| `npm run db:migrate` | Apply migrations from `drizzle/` |
| `npm run db:studio` | Drizzle Studio |
| `node scripts/generate-icons.mjs` | Regenerate PWA icons |

## Deployment

Intended target: Vercel + Neon Postgres (not yet set up). `DATABASE_URL` and `AUTH_SECRET` are the only required env vars.
