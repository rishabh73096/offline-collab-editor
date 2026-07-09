# Local-First Collaborative Document Editor — Module-Wise Build Plan

> Assignment: House of Edtech — Fullstack Developer Assignment 2 (v2.1)
> Status: pre-implementation. `app/` is the untouched create-next-app scaffold. `components/ hooks/ lib/ prisma/ scripts/ server/ tests/ types/` are empty. `package.json` already pins the intended stack (Dexie, Yjs, y-websocket, socket.io, next-auth, jose, bcryptjs, Prisma, Zod, Zustand) — this plan builds on top of that, it does not replace it.

---

## 0. Architecture Decision Record (read this first)

**This is not a CRUD app.** The hard part the evaluators are grading is: *what happens when two people edit the same paragraph while one of them is offline, and their laptop reconnects three hours later.* Everything below is organized to answer that question concretely per module.

Key decisions to lock in before writing code:

| Decision | Choice | Why |
|---|---|---|
| CRDT engine | **Yjs** | Industry-proven (Notion-alikes, Linear, Jupyter). Gives you `Y.Doc`, binary update encoding, state-vector diffing, and an `awareness` protocol (presence/cursors) for free — you don't hand-roll conflict resolution. |
| Realtime transport | **Custom `ws` server implementing the y-websocket sync protocol**, in `server/`. Drop `socket.io` for the CRDT channel — its JSON framing is redundant when Yjs already ships an efficient binary sync protocol. Keep `socket.io` only if you want a separate channel for non-CRDT events (toast notifications, "user X joined" chat) — otherwise remove it to avoid two competing realtime stacks. | Vercel serverless functions cannot hold a persistent WS connection, so the collab server **must** be deployed as a standalone Node process (Railway/Fly.io/Render), independent from the Next.js app on Vercel. This is a "real-world consideration" the rubric explicitly asks about. |
| Local-first store | **Dexie (IndexedDB)** | Primary source of truth on the client. The Next.js UI reads/writes Dexie synchronously-feeling (async but never blocks on network); the server is just another peer to sync with. |
| Server DB | **PostgreSQL via Prisma** | Relational fit for Users, Documents, Memberships (roles), Versions. Store Yjs binary state as `Bytes`. |
| Auth | **NextAuth (Credentials, bcrypt) + JWT (jose) for the WS handshake** | HTTP routes use NextAuth session; the raw WebSocket upgrade can't carry a cookie session cleanly cross-origin, so mint a short-lived JWT the client passes as a WS query/subprotocol param and the `server/` process verifies with `jose` before accepting the upgrade. |
| Validation | **Zod on every payload crossing a trust boundary** (sync push, WS message envelope, version restore) | Directly answers the "malformed payload OOM" requirement. |
| AI | **Vercel AI SDK + Groq (fast/cheap) or Gemini** | Summarize / rewrite selection, streamed. |

---

## 1. Authentication

**Goal:** every request (HTTP and WS) is tied to a verified user identity.

- `app/api/auth/[...nextauth]/route.ts` — NextAuth Credentials provider, email+password, `bcryptjs` for hashing (`lib/auth/hash.ts`).
- Session strategy: JWT (not database sessions) so the same token shape can be reused to authorize the WebSocket handshake.
- `lib/auth/getSession.ts` — server-side helper (`auth()` wrapper) used in every API route and Server Component that touches a document.
- Short-lived **collab token**: `app/api/collab-token/route.ts` issues a `jose`-signed JWT (`{ userId, docId, role, exp: 60s }`) *after* checking the user is actually a member of that document. The client sends this token when opening the WebSocket; it is single-purpose, not the NextAuth session token, and expires fast so it can't be replayed later.
- Passwords never touch the client; NextAuth pages under `app/(auth)/login`, `app/(auth)/register`.

**Deliverable files:** `app/api/auth/[...nextauth]/route.ts`, `app/api/collab-token/route.ts`, `lib/auth/*`, `app/(auth)/*`.

---

## 2. Roles & Authorization (Owner / Editor / Viewer)

**Goal:** role is enforced at *every* layer, not just hidden in the UI.

- Prisma model `DocumentMember(userId, documentId, role: OWNER|EDITOR|VIEWER)` — many-to-many between User and Document.
- **HTTP layer:** every `app/api/documents/[id]/**` route loads the membership row first; 403 if missing or role insufficient for the verb (e.g. Viewer can `GET` but not `PATCH`/`POST version`).
- **WS layer (the part people forget):** when `server/` accepts a connection, it checks the role embedded in the collab-token. If `role === VIEWER`, the server accepts the socket **read-only**: it still forwards Yjs sync/awareness updates *to* that client (so they see live edits) but drops/rejects any `update` message *originating from* that client before it ever reaches the shared `Y.Doc`. This is the literal mandatory requirement ("Viewers must not push state updates").
- **DB layer (tenant isolation):** either Postgres RLS policies keyed on `current_setting('app.user_id')` set per-request via `SET LOCAL`, or — simpler to get right for the assignment scope — strict Prisma scoping: no query for `Document`/`Version`/`Content` ever runs without a `where: { members: { some: { userId } } }` clause, enforced through a single repository layer (`lib/repositories/documents.ts`) so there's exactly one code path that can query documents, and it's impossible to accidentally bypass. Document which one you chose and why in the README — the rubric explicitly asks for RLS **or** strict ORM scoping, pick one and be deliberate.

**Deliverable files:** `prisma/schema.prisma` (Member/Role model), `lib/authz/*`, `lib/repositories/documents.ts`, role checks inline in `server/index.ts`.

---

## 3. Local-First Storage

**Goal:** open/edit/close a document with **zero network requests blocking the UI**.

- Dexie DB (`lib/db/dexie.ts`) with tables:
  - `documents`: `{ id, title, ydocState: Uint8Array, updatedAt, lastSyncedVector: Uint8Array }` — the authoritative local copy, stored as the Yjs binary update.
  - `outbox`: `{ id, docId, update: Uint8Array, createdAt }` — append-only log of local edits not yet confirmed by the server (see Module 4).
  - `meta`: connection/sync bookkeeping (`lastSyncAt`, `pendingCount`).
- Editor component binds directly to an in-memory `Y.Doc`; a Dexie-backed persistence provider (`y-indexeddb`-style, hand-rolled or reuse the `y-indexeddb` package if you want to save time) hydrates the `Y.Doc` from `documents.ydocState` on open and writes back on every local transaction — debounced, off the main render path.
- Opening a document = read from Dexie only. No `fetch` in the critical path. Network sync is a background concern layered on top (Module 4).
- Perf note for the "no lag during rapid typing" rubric point: Yjs updates are diffed at the transaction level, and Dexie writes should be batched/debounced (e.g. 300ms idle) rather than on every keystroke.

**Deliverable files:** `lib/db/dexie.ts`, `lib/collab/persistence.ts`, `hooks/useDocument.ts`.

---

## 4. Offline Sync Queue

**Goal:** local edits queue while offline; on reconnect, push local → pull remote, **without destroying either side's work.**

- **Outbox pattern:** every local Yjs transaction produces a binary update (`Y.encodeStateAsUpdate(doc, priorStateVector)`); it's appended to the Dexie `outbox` table immediately (this *is* the durability guarantee — survives tab close/crash).
- `lib/sync/engine.ts` — a sync loop that:
  1. Listens to `navigator.onLine` / `online` events and a periodic heartbeat ping to the collab server (belt-and-braces, since `navigator.onLine` lies on some networks).
  2. On "online": opens the WS connection with the collab-token, sends the client's current Yjs **state vector** first.
  3. Server responds with only the updates the client is missing (standard Yjs sync-step1/2 protocol) — pull.
  4. Client flushes its `outbox` entries to the server in order — push. Because these are CRDT updates, not full-document overwrites, order and timing don't matter for correctness (this is *why* CRDTs were chosen over last-write-wins).
  5. On server ack per outbox entry, delete it from Dexie; on failure, exponential backoff retry (cap + jitter), entry stays queued.
- Because merging happens via `Y.applyUpdate`, there is no "overwrite" step anywhere — local and remote changes are commutatively merged, which is the actual answer to "without overwriting or destroying the user's offline work."
- UI: a `SyncStatus` indicator (`components/SyncStatusBadge.tsx`) driven by `zustand` store (`lib/store/syncStore.ts`) reflecting `offline | syncing | synced | error(n pending)`.

**Deliverable files:** `lib/sync/engine.ts`, `lib/store/syncStore.ts`, `components/SyncStatusBadge.tsx`.

---

## 5. WebSocket Collaboration (server)

**Goal:** a standalone realtime server that authenticates, authorizes, and relays CRDT updates + presence between connected clients for a document.

- `server/index.ts` — Node process (separate from Next.js), using `ws` (or `y-websocket`'s server utils directly).
- Connection lifecycle:
  1. Client connects to `wss://collab.<domain>/<docId>?token=<collab-jwt>`.
  2. Server verifies JWT with `jose` (signature + expiry + `docId` claim matches the URL) — reject upgrade otherwise (`4401`/close code, not a crash).
  3. Server holds one in-memory `Y.Doc` per active document (`Map<docId, Y.Doc>`), lazily hydrated from the last persisted Postgres snapshot + any updates since.
  4. Runs the standard Yjs sync protocol (state-vector exchange → update exchange) plus `y-protocols/awareness` for cursors/presence.
  5. Every accepted update is (a) applied to the in-memory doc, (b) broadcast to other connected clients for that doc, (c) persisted (debounced — e.g. every N updates or T seconds, not every keystroke) as the new binary snapshot in Postgres.
  6. Role check from step 2 gates whether an inbound `update` message from *this* client is applied/broadcast at all (Viewer = read-only, see Module 2).
- Presence/connection-status: awareness state also drives the "who's online" UI and the app-wide connection indicator.

**Deliverable files:** `server/index.ts`, `server/auth.ts`, `server/docRegistry.ts`, deployed as its own process (see Module 10).

---

## 6. CRDT-Based Conflict Resolution

**Goal:** deterministic, lossless merging — this is graded as its own line item, so make the mechanism visible, not just "it works because Yjs."

- Document content modeled as `Y.XmlFragment`/`Y.Text` (rich text editor — recommend binding via `y-prosemirror` or `y-tiptap` if using a rich editor, or plain `Y.Text` if the editor is simpler markdown/plaintext).
- Explain in the doc/README **why** this is deterministic: Yjs updates are commutative, associative, and idempotent (CRDT properties) — applying update A then B yields the same document state as B then A, so two offline clients that both mutated the doc converge to the identical final state once both updates are exchanged, with no central "last write wins" clobbering.
- Explicit test scenarios to demonstrate (write these as integration tests, not just manual QA — see Module 11):
  - Two clients offline, both edit different paragraphs → both changes present after sync.
  - Two clients offline, both edit the *same* character range → both edits present, cursor-consistent, no crash, no silent data loss.
  - One client offline for a long time (many local edits queued), reconnects against a doc that has diverged heavily on the server → full convergence, outbox drains cleanly.
- `lib/collab/merge.ts` is intentionally thin — the "algorithm" is Yjs's; your job is the plumbing around it (state vectors, persistence cadence, conflict test coverage) which is what's actually being evaluated.

---

## 7. Version History & Time Travel

**Goal:** capture snapshots, view a timeline, restore safely **without corrupting the live shared doc for other active collaborators.**

- Prisma model `DocumentVersion(id, documentId, snapshot: Bytes, label, createdById, createdAt)` — `snapshot` = `Y.encodeStateAsUpdate(doc)` at capture time (full state, not a diff, for simplicity of restore).
- Capture triggers: manual "Save version" action (Owner/Editor), plus optional auto-snapshot on a schedule (e.g. every 50 updates or 10 minutes of active editing) via the server's debounced persistence hook (Module 5).
- **Restore, done safely:** the critical design point the rubric is testing. Do **not** replace the live `Y.Doc` by deleting and reloading it — that would blow away any concurrent edits from other connected clients that happened after the snapshot. Instead:
  1. Load the target version into a scratch `Y.Doc`.
  2. Compute the diff needed to bring the *current* live doc's content to match the target version's content (e.g., diff the text/structure and apply as a new set of Yjs operations — a "revert" transaction — rather than a raw state overwrite).
  3. Apply that diff as one atomic transaction on the live doc. It propagates through the normal sync/broadcast path like any other edit, so every connected client (Owner, Editor, Viewer) sees it as an incremental, causally-ordered change, and the CRDT history/log isn't corrupted.
  4. Record the restore itself as a new version entry ("Restored to v12"), so time-travel is itself append-only and auditable — never destructive.
- UI: `app/documents/[id]/history` — timeline list, diff/preview of a version before committing to restore, confirmation step (restore is a shared/multi-user-visible action, not undo).

**Deliverable files:** `prisma/schema.prisma` (Version model), `lib/collab/versioning.ts`, `app/api/documents/[id]/versions/**`, `app/documents/[id]/history/*`.

---

## 8. AI Summary / Rewriter

**Goal:** genuinely useful add-on, not a bolted-on chat widget.

- Vercel AI SDK (`ai` package) + Groq or Gemini provider.
- `app/api/ai/summarize/route.ts` — streams a summary of current document content (extract plain text from the `Y.Doc` server-side or client-side, send to model).
- `app/api/ai/rewrite/route.ts` — takes a selected text range + instruction ("make formal", "shorten", "fix grammar"), returns rewritten text; client applies the result as a normal Yjs transaction (so the AI edit flows through the exact same CRDT path as a human edit — it's just another author, which also means it merges safely if others are editing concurrently).
- Rate-limit and role-gate these routes too (Viewers probably shouldn't be able to mutate content via AI rewrite even though it's "just an API call").

**Deliverable files:** `app/api/ai/*`, `lib/ai/client.ts`, `components/AiToolbar.tsx`.

---

## 9. Security & Data Validation (cross-cutting, but explicitly graded)

This is its own rubric line — treat it as a module, don't leave it implicit.

- **Payload size caps before parsing:** reject any WS message or HTTP body over a fixed byte limit (e.g. 1–2 MB) at the transport layer *before* attempting to decode it as a Yjs update — this is the direct answer to "malformed payload that OOMs the server." Never `JSON.parse` or `Y.applyUpdate` on unbounded input.
- **Zod schemas** for every envelope: sync-push HTTP fallback route, version-restore request, AI request bodies. Reject and 400 on schema mismatch before touching business logic.
- **Try/catch isolation per connection:** a malformed/corrupt Yjs update from one client must `catch` inside that connection's handler and close *that* socket — never let one bad client crash the shared `server/` process (which would take down every other collaborator on every document).
- **Rate limiting** per user/IP on HTTP write routes and WS message rate (basic token bucket in `lib/security/rateLimit.ts`).
- **Tenant isolation:** covered in Module 2 (RLS or strict ORM scoping) — call it out again in a short `docs/SECURITY.md` write-up since the rubric asks you to "discuss mitigation strategies."

---

## 10. Deployment & CI/CD

**Goal:** two deployables, one repo.

- **Next.js app** → Vercel (SSR/SSG/API routes as normal).
- **`server/` (WS collab server)** → Railway/Fly.io/Render (anything supporting a persistent Node process). Document the split and *why* explicitly in the README — it's a real architectural constraint (Vercel functions are short-lived/stateless, WS needs a long-lived stateful process holding `Y.Doc`s in memory), and the rubric rewards you for naming this tradeoff.
- Postgres: Neon/Supabase/Railway Postgres — wherever, just needs to be reachable from both deployables.
- `.github/workflows/ci.yml`: on PR — install, typecheck, lint, run unit+integration tests (Module 11), Prisma migrate check against a throwaway test DB. On merge to `main` — deploy hooks for both targets (Vercel auto-deploys on push if connected; add a workflow step or Railway/Fly deploy action for `server/`).

**Deliverable files:** `.github/workflows/ci.yml`, `server/Dockerfile` (if the host wants a container), `vercel.json` if needed, `docs/DEPLOYMENT.md`.

---

## 11. Testing (specifically the sync engine — this is called out by name in the rubric)

- **Unit** (Vitest/Jest): CRDT merge helper functions, Zod schemas, role-check utilities, sync-store reducer logic.
- **Integration**: spin up the `server/` WS server against a test Postgres, simulate two client connections with real `Y.Doc`s — assert convergence after out-of-order update delivery, assert Viewer-originated updates are dropped, assert oversized payload is rejected without crashing the process.
- **E2E** (Playwright): two browser contexts as two users on the same document; take one offline (`context.setOffline(true)`), make edits in both, bring the offline one back, assert both sets of edits are visible in both contexts and the SyncStatus badge reflects state transitions correctly. This single test is probably the most valuable thing you can show an evaluator — it's a literal demonstration of the hardest requirement in the assignment.

**Deliverable files:** `tests/unit/*`, `tests/integration/*`, `tests/e2e/*`, `vitest.config.ts` / `playwright.config.ts`.

---

## Suggested Prisma Schema (starting point)

```prisma
model User {
  id            String            @id @default(cuid())
  email         String            @unique
  passwordHash  String
  name          String?
  memberships   DocumentMember[]
  versions      DocumentVersion[]
  createdAt     DateTime          @default(now())
}

model Document {
  id          String            @id @default(cuid())
  title       String
  state       Bytes             // latest authoritative Y.Doc snapshot
  members     DocumentMember[]
  versions    DocumentVersion[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}

model DocumentMember {
  id          String    @id @default(cuid())
  documentId  String
  userId      String
  role        Role
  document    Document  @relation(fields: [documentId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
  @@unique([documentId, userId])
}

model DocumentVersion {
  id            String    @id @default(cuid())
  documentId    String
  snapshot      Bytes
  label         String?
  createdById   String
  createdAt     DateTime  @default(now())
  document      Document  @relation(fields: [documentId], references: [id])
  createdBy     User      @relation(fields: [createdById], references: [id])
}

enum Role {
  OWNER
  EDITOR
  VIEWER
}
```

## Suggested Folder Mapping (fits the existing empty scaffold)

```
app/                     Next.js routes (auth pages, document UI, API routes)
components/              Editor, SyncStatusBadge, HistoryTimeline, AiToolbar, RoleBadge
hooks/                   useDocument, useAwareness, useSyncStatus
lib/
  auth/                  NextAuth config, hashing, session helpers
  authz/                 role-check helpers
  db/                    dexie.ts (client), prisma.ts (server)
  collab/                persistence.ts, merge.ts, versioning.ts
  sync/                  engine.ts (outbox drain, reconnect logic)
  store/                 zustand stores (sync status, presence)
  security/              rateLimit.ts, payload size guards
  ai/                    AI SDK client + prompt helpers
prisma/                  schema.prisma, migrations/
server/                  standalone WS collab server (separate deploy target)
tests/                   unit/ integration/ e2e/
types/                   shared TS types/zod-inferred types
docs/                    this file, SECURITY.md, DEPLOYMENT.md
```

## Build Order (phased, so you always have something runnable)

1. **Auth + Roles + Prisma schema** — login/register, DocumentMember model, protected routes.
2. **Local-first single-user**: Dexie + Y.Doc + editor UI, works fully offline, zero server dependency yet.
3. **Collab server + sync engine**: bring up `server/`, wire the outbox/sync engine, get two browser tabs converging in real time.
4. **Role enforcement on the WS path** (Viewer read-only) + payload validation/security hardening.
5. **Version history**: snapshot capture + safe restore-as-transaction.
6. **AI summary/rewrite** add-on.
7. **Testing pass**: unit → integration → the offline/reconnect Playwright e2e test (do this before deployment, it'll catch real bugs).
8. **Deployment**: Vercel (app) + Railway/Fly (server) + CI workflow.
9. Polish pass: accessibility, connection-status UI, README with your name/GitHub/LinkedIn per submission guidelines.

---

*This document is the working plan, not a spec — update it as decisions change during implementation.*
