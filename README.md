# Offline Collaborative Document Editor

A local-first, collaborative document editor with offline synchronization, CRDT-based deterministic conflict resolution, and granular version history — built with Next.js 16, React, PostgreSQL, and Yjs.

> Submission for the House of Edtech Fullstack Developer Assignment 2 (v2.1).
> **Author:** _TODO: your name_ · **GitHub:** _TODO: your GitHub profile URL_ · **LinkedIn:** _TODO: your LinkedIn profile URL_

See [docs/MODULE_PLAN.md](docs/MODULE_PLAN.md) for the full architecture decisions and module-by-module build plan.

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth (Credentials provider, JWT sessions) + short-lived `jose`-signed tokens for the WebSocket handshake
- **Local-first storage:** Dexie (IndexedDB)
- **CRDT / realtime collaboration:** Yjs + a standalone WebSocket server (`server/`)
- **Validation:** Zod
- **Styling:** Tailwind CSS
- **Testing:** Vitest (unit/integration), Playwright (e2e, planned)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill in real values:
   ```bash
   cp .env.example .env.local
   ```
   You need a reachable PostgreSQL connection string (e.g. from [Neon](https://neon.tech) or [Supabase](https://supabase.com)) for `DATABASE_URL`, plus random secrets for `NEXTAUTH_SECRET` and `COLLAB_JWT_SECRET` (generate with `openssl rand -base64 32`).
3. Apply the database schema:
   ```bash
   npx prisma migrate dev
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run test` | Run the Vitest unit test suite |
| `npm run test:watch` | Vitest in watch mode |
| `npx prisma studio` | Browse the database |

## Project Structure

```
app/            Next.js routes: auth pages, document UI, API routes
components/     UI components (auth, documents, providers)
docs/           Architecture and planning docs
lib/            Auth, authz, db, validation, security, repositories
prisma/         Database schema and migrations
server/         Standalone WebSocket collaboration server (separate deploy target)
tests/          Unit / integration / e2e tests
types/          Shared TypeScript type augmentations
```

## Current Status

Phase 1 (Authentication + Roles + Prisma schema) is implemented: Credentials-based auth via NextAuth, Owner/Editor/Viewer document roles enforced through a single repository chokepoint, a short-lived collab token for the future WebSocket handshake, and a bounded JSON body reader as a first line of defense against oversized payloads. See [docs/MODULE_PLAN.md](docs/MODULE_PLAN.md) for what's next (local-first storage, offline sync queue, CRDT collaboration server, version history, AI features, deployment, e2e testing).
