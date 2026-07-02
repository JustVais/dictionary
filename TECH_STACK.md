# Vocabulary App — Tech Stack

## Overview
A vocabulary-learning app (word lists, flashcards, spaced repetition) built as an installable PWA, deployed on Vercel, with Neon Postgres as the database.

## Core Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js** (App Router) | React-based, first-class Vercel support (zero-config deploys, edge/serverless functions), file-based routing, API routes for backend logic. |
| Language | **TypeScript** | Type safety across frontend, API routes, and DB schema. |
| Styling | **Tailwind CSS** + **shadcn/ui** | Fast to build clean UI; shadcn gives accessible, unstyled-by-default components you own the code for. Note: this shadcn project's default style (`base-nova`) is built on **Base UI** (`@base-ui/react`), not Radix — component internals use the `render` prop instead of `asChild`/`Slot`. |
| PWA | **Serwist** (successor to next-pwa, actively maintained) | Service worker + manifest generation for installability, offline caching of word lists. Requires building with `next build --webpack` since Serwist's Next.js plugin needs webpack, while Next 16 defaults to Turbopack. |
| Database | **Neon Postgres** (via Vercel Marketplace integration) | Serverless Postgres, autoscaling, branching for preview environments per PR. |
| DB Driver | **`pg`** (node-postgres) via `drizzle-orm/node-postgres` | Used for both local Docker and Neon — Neon's Vercel-injected `DATABASE_URL` already points at a pooled connection (PgBouncer via Neon's proxy), solving the same serverless-connection-limit problem `@neondatabase/serverless` exists for, so a single driver/code path works identically in both environments. |
| ORM | **Drizzle ORM** | Lightweight, SQL-like, great TS inference, fast cold starts (important for serverless functions), first-class Neon support. Prisma is a fine alternative but has heavier cold-start overhead. |
| Auth | **Auth.js (NextAuth v5)** with **Credentials provider** | Login + password auth; Auth.js handles sessions/JWT, Credentials provider verifies against your own `users` table. |
| Password hashing | **bcrypt** (or `argon2`) | Never store plaintext passwords; bcrypt via `bcryptjs` works fine in Node runtime (avoid Edge runtime for the auth route since bcrypt needs Node APIs). |
| Validation | **Zod** | Shared schema validation between forms and API routes/server actions. |
| State/data fetching | **TanStack Query** (or Next.js Server Actions + React cache) | Handles offline-friendly caching, mutations, optimistic updates for flashcard reviews. |
| Forms | **React Hook Form** + Zod resolver | Standard pairing, minimal re-renders. |
| Deployment | **Vercel** | Matches your requirement; integrates CI/CD from Git, preview deployments, Neon Marketplace connection auto-injects `DATABASE_URL`. |
| Local dev DB | **Docker** (official `postgres` image via Docker Compose) | Run Postgres locally so development doesn't touch the live Neon database; schema/migrations stay identical since both are plain Postgres. |

## Vocabulary-App-Specific Notes

- **Spaced repetition**: **FSRS** via the `ts-fsrs` package (replaced the original SM-2 in v2) — 4 grades, intra-day learning steps, interval fuzz. Wrapped in pure functions in `src/lib/srs.ts` so it's unit-testable and usable client-side (button interval previews) and server-side (scheduling).
- **Translation & word forms**: Russian input is translated ru→en via MyMemory (free, no key) in `src/lib/translate.ts`; inflected word forms are generated locally with `compromise` in `src/lib/word-forms.ts`.
- **Offline support**: cache the user's active word deck and review queue in IndexedDB (via `idb` library) so reviews work offline; sync back to Postgres via a background sync / on-reconnect mutation.
- **PWA installability**: requires a `manifest.json` (icons, theme color, `display: standalone`) and HTTPS (Vercel gives you this by default).
- **Migrations**: use `drizzle-kit` for schema migrations; run against Neon's pooled connection string in production, direct connection for migrations.
- **Preview environments**: Neon's Vercel integration can auto-create a DB branch per PR — useful for testing schema changes in isolation before merging.

## Local Development (Docker)

Run Postgres locally in Docker so day-to-day dev doesn't hit Neon; point `DATABASE_URL` at Neon only in Vercel (preview/prod) and, optionally, when you explicitly want to test against it.

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: vocab
      POSTGRES_PASSWORD: vocab
      POSTGRES_DB: vocabulary
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```
(Host port `5433` is used instead of the default `5432` to avoid clashing with other local Postgres containers.)

`.env.local` (gitignored):
```
DATABASE_URL=postgresql://vocab:vocab@localhost:5433/vocabulary
AUTH_SECRET=<generate with `openssl rand -base64 32`>
```

- `docker compose up -d` to start the local DB, `docker compose down` to stop it.
- Because `pg` speaks the standard Postgres wire protocol, the same schema/migrations apply to local Docker and Neon — only the connection string changes per environment.
- Use `drizzle-kit push` or `drizzle-kit migrate` locally against Docker, then apply the same migrations to Neon in CI/deploy.

## Actual Repo Structure
```
src/
  auth.ts, proxy.ts       # Auth.js config, Next 16 proxy.ts (renamed from middleware.ts)
  db/                     # Drizzle schema, client, migration runner
  lib/                    # auth-guard, validation, srs (SM-2), dictionary client, password hashing, stats
  hooks/use-swipe.ts       # swipe-vs-tap gesture hook for review cards
  components/
    ui/                    # shadcn/Base UI primitives
    layout/                # header, bottom tab bar, app shell
    vocabulary/, cards/, translate/, stats/
  app/
    manifest.ts, sw.ts (at src/sw.ts)
    api/auth/[...nextauth]/route.ts
    (auth)/login, signup     # bare layout, no nav
    (app)/vocabulary, cards, translate, stats   # AppShell layout, auth-gated
drizzle/                  # generated SQL migrations
public/icons/             # PWA icons (regenerate with `node scripts/generate-icons.mjs`)
```

## Build Status
All 4 sections (Vocabulary, Cards with FSRS spaced repetition, Translate with Russian input, Stats), login/password auth, the responsive shell, dark mode, and PWA/Serwist support are implemented — see `FUNCTIONALITY.md` for the full behavior spec. Deployment to Vercel + Neon has not been done yet; local development runs against the Docker Postgres container described above.
