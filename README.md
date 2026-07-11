# Marginal — a local-first collaborative document editor

A document editor that treats your device as the source of truth, not the server. Open, edit, and close documents with **zero network requests blocking the UI**, then reconcile automatically — via a CRDT, not last-write-wins — the moment you're back online.

> Submission for the House of Edtech Fullstack Developer Assignment 2 (v2.1).
> **Author:** _TODO: your name_ · **GitHub:** _TODO: your GitHub profile URL_ · **LinkedIn:** _TODO: your LinkedIn profile URL_

## Live Deployment

- **App:** [offline-collab-editor.vercel.app](https://offline-collab-editor.vercel.app)
- **Collab server:** hosted on Render — `https://offline-collab-editor.onrender.com`

> Render's free tier spins the collab server down after inactivity. The first real-time connection after a period of idle can take 30–60s to wake it back up (you'll see the sync badge sit on "Connecting…" briefly) — that's the hosting tier, not the app. The app itself never blocks on this; local editing works instantly regardless.

See [docs/MODULE_PLAN.md](docs/MODULE_PLAN.md) for the full architecture decisions and module-by-module build plan/status, or [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to deploy your own copy.

## Features

- **Local-first storage** — every document's content is a [Yjs](https://docs.yjs.dev/) CRDT (`Y.Doc`) persisted to the browser's IndexedDB via Dexie. Opening a document reads from disk only; there is no `fetch` in the critical path.
- **Real-time collaboration** — a standalone WebSocket server (`server/`) relays Yjs sync + awareness (presence/cursors) between everyone viewing the same document, over a hand-rolled protocol built on `y-protocols`.
- **Deterministic, conflict-free merging** — because the document is a CRDT, two people editing offline (or just at the same time) both keep their words when they reconnect. No merge conflicts, no silent data loss.
- **Version history & safe restore** — capture a labeled snapshot at any time; restoring computes a minimal diff and applies it as a normal, live-broadcast edit (never a raw overwrite), so it can't clobber what other connected collaborators are doing at that moment.
- **Roles, enforced everywhere** — Owner / Editor / Viewer, checked at the HTTP layer, the WebSocket layer (a Viewer's own edits are accepted onto their socket but silently dropped before they ever reach the shared document), and the database layer (a single repository chokepoint — no route ever queries Prisma directly).
- **Security-conscious sync** — every payload crossing a trust boundary is size-capped and Zod-validated before it's parsed, specifically to prevent a malformed or oversized sync payload from taking the server down. The collab server also survives a dropped/suspended database connection (see `docs/MODULE_PLAN.md` and the `roomRegistry` tests) instead of crashing.
- **Authentication** — NextAuth Credentials provider (bcrypt-hashed passwords), plus a separate short-lived signed token that authorizes the WebSocket handshake.

Not yet built (see [docs/MODULE_PLAN.md](docs/MODULE_PLAN.md) for the plan): a UI for inviting/changing a collaborator's role (today that's one manual step via Prisma Studio — see below), AI summarize/rewrite, and CI.

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth (Credentials provider, JWT sessions) + short-lived `jose`-signed tokens for the WebSocket handshake
- **Local-first storage:** Dexie (IndexedDB)
- **CRDT / realtime collaboration:** Yjs + a standalone WebSocket server (`server/`)
- **Validation:** Zod
- **UI:** Tailwind CSS v4, lucide-react icons, a custom "paper & ink" design system (see `app/globals.css`)
- **Testing:** Vitest (unit + integration), Playwright (installed, used for manual UI verification; scripted e2e not yet checked in)

---

## Quickstart for developers

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in real values — see the comments in `.env.example` for what each one is for and why (e.g. why there's both a pooled and a direct database URL). At minimum you need:

- `DATABASE_URL` / `DIRECT_DATABASE_URL` — a Postgres connection string (e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com)). If you don't have a pooled/direct split, set both to the same value.
- `NEXTAUTH_SECRET`, `COLLAB_JWT_SECRET`, `COLLAB_INTERNAL_SECRET` — generate each with `openssl rand -base64 32`.
- `COLLAB_SERVER_PORT` / `NEXT_PUBLIC_COLLAB_WS_URL` / `COLLAB_INTERNAL_URL` — defaults (`1234` / `ws://localhost:1234` / `http://localhost:1234`) are fine for local dev.

### 3. Database

```bash
npx prisma migrate dev
```

### 4. Run it — **two processes**

The realtime collaboration server is intentionally a separate long-running process from the Next.js app (Vercel-style serverless functions can't hold a persistent WebSocket connection — see `docs/MODULE_PLAN.md` for why). Run both, in two terminals:

```bash
npm run dev          # Next.js app  → http://localhost:3000
npm run server:dev    # Collab server → ws://localhost:1234
```

The app works without the collab server running — you just won't get real-time sync (the UI will show an "Offline" badge and keep working locally).

### 5. Verify your changes

```bash
npx tsc --noEmit          # typecheck
npm run lint               # ESLint
npm run test                # Vitest — unit + integration (currently 70+ tests)
npm run build                # production build
```

The integration tests under `tests/integration/server/` spin up a real instance of the collab server (in-process, ephemeral port, in-memory persistence fake) and drive it with real WebSocket clients — they cover role-gated writes, malformed-payload handling, and surviving a persistently failing database, without needing your real Postgres.

---

## Deployment

Two deployables, not one — the Next.js app (Vercel) and the standalone collab server (Railway/Render/Fly), talking to the same Postgres database. Full step-by-step, including which env var goes where and how to actually verify a live deploy works (not just that it builds): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## How to try it as a user

1. Go to `/` — the landing page. **Create your account** or **Sign in**.
2. On `/documents`, type a title and hit **New document**. It appears instantly — that write only ever touched IndexedDB, no network round-trip.
3. Open the document. Start typing. Reload the tab — your content is still there, read straight from local storage.
4. **See offline-first for real:** open DevTools → Network tab → set throttling to "Offline", keep typing, then set it back to "Online" (or restart the collab server if you stopped it). The sync badge in the editor header goes `Offline → Connecting… → Synced`, and your offline edits are there without you doing anything.
5. **See real-time collaboration:** open the same document URL in a second browser (or an incognito window, signed in as a second account — see below for how to give that account access). Type in one, watch it appear in the other.
6. **Version history:** click **Save version** in the editor toolbar, keep editing, then open **History**. Pick an earlier version and **Restore** — the confirmation step exists because restoring is a shared, live-visible action, not a personal undo.

### Testing roles (Owner / Editor / Viewer)

Every new document's creator is its Owner. There's no "Invite" UI yet (see Features above), so to test Editor/Viewer behavior today:

1. Register a second account at `/register`.
2. Run `npx prisma studio`, open the `document_members` table, and add a row: the document's `id`, the second user's `id`, and `role` = `EDITOR` or `VIEWER`.
3. Sign in as that second account and open the document. A Viewer's editor is read-only in the UI; if you inspect the network traffic, you'll see their edits are also rejected server-side if attempted directly against the WebSocket — the role check isn't just a disabled `<textarea>`.

---

## Project Structure

```
app/            Next.js routes: landing page, auth pages, document UI, API routes
components/     UI components (brand, marketing, auth, documents, editor, versions)
docs/           Architecture and planning docs
hooks/          Client hooks (e.g. useDocument — local hydration + sync engine wiring)
lib/            Auth, authz, db, validation, security, repositories, sync protocol
prisma/         Database schema and migrations
server/         Standalone WebSocket collaboration server (separate deploy target)
tests/          Unit and integration tests
types/          Shared TypeScript type augmentations
```

## Current Status

Implemented and **deployed**: authentication, roles/authorization, local-first storage, the offline sync engine, real-time WebSocket collaboration with CRDT merging, version history with safe restore, and a full visual redesign — live at the URLs above.

Pending (see [docs/MODULE_PLAN.md](docs/MODULE_PLAN.md) Build Order for the full list):

- **Role management UI** — Owner/Editor/Viewer is fully enforced end-to-end (see Features), but there's no in-app way to invite a collaborator or change their role yet; it's a manual `document_members` row via Prisma Studio (see "Testing roles" above). This is the biggest functional gap.
- **AI summarize/rewrite** add-on — not started.
- **CI** — no GitHub Actions workflow yet running typecheck/lint/test on push.
- **Scripted end-to-end test** — the offline/reconnect/multi-collaborator scenario has been verified manually and via integration tests (`tests/integration/server/`), but not as a single checked-in Playwright e2e script.
- Fill in the author/GitHub/LinkedIn line at the top of this file before final submission.
