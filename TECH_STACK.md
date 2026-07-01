# Vocabulary App — Tech Stack

## Overview
A vocabulary-learning app (word lists, flashcards, spaced repetition) built as an installable PWA, deployed on Vercel, with Neon Postgres as the database.

## Core Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js** (App Router) | React-based, first-class Vercel support (zero-config deploys, edge/serverless functions), file-based routing, API routes for backend logic. |
| Language | **TypeScript** | Type safety across frontend, API routes, and DB schema. |
| Styling | **Tailwind CSS** + **shadcn/ui** | Fast to build clean UI; shadcn gives accessible, unstyled-by-default components you own the code for. |
| PWA | **Serwist** (successor to next-pwa, actively maintained) | Service worker + manifest generation for installability, offline caching of word lists. |
| Database | **Neon Postgres** (via Vercel Marketplace integration) | Serverless Postgres, autoscaling, branching for preview environments per PR. |
| DB Driver | **`@neondatabase/serverless`** | HTTP/WebSocket driver designed for serverless/edge — avoids TCP connection limits that break standard `pg` on Vercel functions. |
| ORM | **Drizzle ORM** | Lightweight, SQL-like, great TS inference, fast cold starts (important for serverless functions), first-class Neon support. Prisma is a fine alternative but has heavier cold-start overhead. |
| Auth | **Auth.js (NextAuth v5)** with **Credentials provider** | Login + password auth; Auth.js handles sessions/JWT, Credentials provider verifies against your own `users` table. |
| Password hashing | **bcrypt** (or `argon2`) | Never store plaintext passwords; bcrypt via `bcryptjs` works fine in Node runtime (avoid Edge runtime for the auth route since bcrypt needs Node APIs). |
| Validation | **Zod** | Shared schema validation between forms and API routes/server actions. |
| State/data fetching | **TanStack Query** (or Next.js Server Actions + React cache) | Handles offline-friendly caching, mutations, optimistic updates for flashcard reviews. |
| Forms | **React Hook Form** + Zod resolver | Standard pairing, minimal re-renders. |
| Deployment | **Vercel** | Matches your requirement; integrates CI/CD from Git, preview deployments, Neon Marketplace connection auto-injects `DATABASE_URL`. |
| Local dev DB | **Docker** (official `postgres` image via Docker Compose) | Run Postgres locally so development doesn't touch the live Neon database; schema/migrations stay identical since both are plain Postgres. |

## Vocabulary-App-Specific Notes

- **Spaced repetition**: implement SM-2 (or a simplified Leitner system) for review scheduling. Keep the algorithm as a pure TS function so it's easily unit-tested and reusable client/server side.
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
- Because Drizzle + `pg`/`@neondatabase/serverless` both speak standard Postgres wire protocol, the same schema/migrations apply to local Docker and Neon — only the connection string changes per environment.
- Use `drizzle-kit push` or `drizzle-kit migrate` locally against Docker, then apply the same migrations to Neon in CI/deploy.

## Suggested Repo Structure
```
/app                 # Next.js App Router pages & layouts
/app/api             # API routes (if not using server actions exclusively)
/components          # React components (shadcn-based)
/lib
  /db                # Drizzle schema, client, migrations
  /srs               # spaced-repetition algorithm
/public
  manifest.json
  icons/
/drizzle             # generated migrations
```

## Suggested Order of Setup
1. `npx create-next-app@latest` (TypeScript, App Router, Tailwind)
2. Add `docker-compose.yml` for local Postgres, `docker compose up -d`
3. Set up Drizzle ORM + `drizzle-kit` + initial schema (users, words, decks, review_logs) against local Docker DB
4. Add Neon Postgres via Vercel Marketplace → auto-adds `DATABASE_URL` env var for preview/prod
5. Add Auth.js with Credentials provider (bcrypt-hashed passwords) + Drizzle adapter
6. Add Serwist for PWA (manifest + service worker + offline caching strategy)
7. Build core flows: sign up / log in → add word → review (SRS) → stats
8. Deploy to Vercel, verify PWA installability + offline behavior on a real device
