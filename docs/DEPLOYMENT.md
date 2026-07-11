# Deployment

This app has **two deployables**, not one:

| Deployable | What it is | Where it goes |
| --- | --- | --- |
| The Next.js app | pages, API routes, auth | Vercel |
| The collab server (`server/`) | the standalone WebSocket process | Railway (or Render / Fly.io) |

They're separate on purpose: Vercel's Next.js functions are short-lived/serverless and cannot hold a persistent WebSocket connection open. The collab server needs to run as a normal, always-on Node process, holding an in-memory `Y.Doc` per active document — so it needs a host built for that, not a serverless one.

Both deployables talk to the **same** Postgres database.

---

## 0. Prerequisites

- A GitHub repo with this code pushed (you already have this).
- A Postgres database reachable from the internet — [Neon](https://neon.tech) (recommended, generous free tier) or [Supabase](https://supabase.com). Get **two** connection strings from Neon: the **pooled** one (hostname has a `-pooler` suffix) and the **direct** one. See the comments in `.env.example` for why.
- Three random secrets, generate them now so you have them ready:
  ```bash
  openssl rand -base64 32   # run this three times, or once per line below
  ```
  You'll paste these as `NEXTAUTH_SECRET`, `COLLAB_JWT_SECRET`, and `COLLAB_INTERNAL_SECRET` — three **different** values.

## 1. Run the migration once, from your machine

Before deploying, apply the schema to your production database (point `DATABASE_URL`/`DIRECT_DATABASE_URL` in your local `.env` at the *production* Neon project, temporarily):

```bash
npx prisma migrate deploy
```

(`migrate deploy` — not `migrate dev` — it just applies existing migrations, no prompts, no shadow database. This is the command CI/deploy pipelines are supposed to use.)

## 2. Deploy the collab server first (Railway)

You need its public URL before configuring the Next.js app, so do this one first.

1. [railway.app](https://railway.app) → sign in with GitHub → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. Railway will create one service and try to guess how to run it. Open that service → **Settings**:
   - **Build Command:** `npm install` (this also runs `prisma generate` automatically via the `postinstall` script)
   - **Start Command:** `npm run server:start`
   - Leave the root directory as the repo root — the collab server and the Next.js app live in the same repo, this service just runs a different start command.
3. **Settings → Networking → Generate Domain** so it's reachable over the internet. Copy that URL (e.g. `https://your-service.up.railway.app`).
4. **Variables** tab, add:
   ```
   DATABASE_URL=<your pooled Neon connection string>
   COLLAB_JWT_SECRET=<secret #2>
   COLLAB_INTERNAL_SECRET=<secret #3>
   ```
   Don't set `PORT` yourself — Railway injects it, and `server/main.ts` already reads `process.env.PORT` first.
5. Deploy. Check the logs for `[collab] listening on :<port>` — that's your confirmation it actually started, not just built.

## 3. Deploy the Next.js app (Vercel)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the same GitHub repo. Vercel auto-detects Next.js — leave the framework preset and build command as default (`next build`, already wired to run `prisma generate` first via `postinstall`).
2. Before the first deploy, add environment variables (**Project Settings → Environment Variables**, or you'll be prompted during import). Use the values from `.env.example` as the template:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled Neon connection string |
   | `DIRECT_DATABASE_URL` | direct Neon connection string |
   | `NEXTAUTH_SECRET` | secret #1 |
   | `NEXTAUTH_URL` | your Vercel production URL, e.g. `https://your-app.vercel.app` (you'll know this after the first deploy — update it and redeploy) |
   | `COLLAB_JWT_SECRET` | secret #2 — **must match** what you set on Railway |
   | `COLLAB_INTERNAL_SECRET` | secret #3 — **must match** what you set on Railway |
   | `COLLAB_INTERNAL_URL` | the Railway URL from step 2.3, e.g. `https://your-service.up.railway.app` |
   | `NEXT_PUBLIC_COLLAB_WS_URL` | the **same** Railway URL, but `wss://` instead of `https://` — this one ships to the browser, so it can't be a secret, and it's the only one prefixed `NEXT_PUBLIC_` |

3. Deploy. Once it's live, go back and set `NEXTAUTH_URL` to the real production URL if you didn't know it up front, then redeploy (Vercel → Deployments → ⋯ → Redeploy) — NextAuth needs this to be exact for callback/redirect handling.

## 4. Test it for real

Don't just check that both services returned 200 — the whole point of this project is what happens under sync/offline/multi-user conditions.

1. Open your Vercel URL, register an account, create a document, type something. Reload — it should still be there (that part never touched the collab server, this is IndexedDB).
2. Open DevTools → Network → check the WS connection was established (Network tab, filter "WS", should show a connection to your Railway `wss://` URL with status 101). If it's not there or shows a connection error:
   - Check `NEXT_PUBLIC_COLLAB_WS_URL` is `wss://` (not `ws://` — Vercel serves HTTPS, browsers block mixed-content `ws://` from an `https://` page).
   - Check `COLLAB_JWT_SECRET` is byte-for-byte identical on both Vercel and Railway — a mismatch fails the handshake silently from the UI's perspective (you'll see a rejected upgrade in the Railway logs).
3. Open the same document in two browsers (or one normal + one incognito, two accounts). Type in one, confirm it appears in the other within a second or two.
4. Take one of them offline (DevTools → Network → Offline), type more, bring it back online — confirm both sides converge instead of one clobbering the other.
5. Save a version, restore it, confirm the other open session sees the restore live.
6. Check Railway's logs while you do this — you should see no crashes, no unhandled rejections. If Neon's compute suspends mid-session, you should see `[collab] load failed... retrying once` (recovered) rather than the process dying.

## Notes

- **`npm run server:start` runs the TypeScript source directly via `tsx`**, not a compiled build. That's an intentional scope tradeoff for this project size, not an oversight — fine for this deployment, worth revisiting (a real `tsc` build step) if this were going into a team's actual production pipeline.
- Redeploying the Next.js app does **not** restart the collab server, and vice versa — they're independent processes. If you change `COLLAB_JWT_SECRET` or `COLLAB_INTERNAL_SECRET`, update and redeploy **both**.
- CI (typecheck/lint/test on every push) isn't wired up yet — see `docs/MODULE_PLAN.md` for that as a next step.
