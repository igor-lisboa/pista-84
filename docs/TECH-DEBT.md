# PISTA 84 — tech debt

## TD-01 · Online storage is two JSON files in Vercel Blob

**Decision.** Everything online lives in a private Vercel Blob store, as two JSON documents so the hot path stays tiny:

- `pista84/scores.json` — one compact `[guid, name, score, distance, achievedAt, createdAt, updatedAt]` row per player, kept sorted best-first. Every finished run touches only this, and the leaderboard reads only this, paginated five at a time by the server.
- `pista84/backups.json` — the heavy per-player cloud saves, written only by the backup button.

Rows hang off each player's permanent GUID, so renaming never loses a score. Code: `src/server/players.ts` (rules), `src/server/blob-store.ts` (store), `src/server/cloud.ts` (HTTP handlers), `api/*.ts` (Vercel functions), `src/ui/leaderboard.ts` (menu dialog).

It was chosen to get an online leaderboard running without provisioning a database. It is a stop-gap: Blob is object storage, not a database.

**What is already handled**

- **Concurrent writers.** Every change is conditional on the blob's ETag (`ifMatch`) and retried up to six times against the newer copy, so two players finishing at the same moment both land in the ranking. After six lost races the request answers 503 and the client retries later.
- **No pointless writes.** A document that did not change is never uploaded (a lower score with the same name changes nothing).
- **Cheap reads.** The ranking is cached in memory for 10 seconds per server instance, and a write refreshes that cache.

**Known limits**

- **Operation quotas.** On the free plan the store allows roughly 2,000 advanced operations (writes) and 10,000 simple operations (reads) a month, as last seen in the dashboard; verify. Each changed score costs one read and one write, each uncached leaderboard view one read. A busy game will exceed this long before storage becomes a problem.
- **Whole-document rewrites.** Each change re-uploads the entire file. At about 90 bytes a row that is fine for thousands of players, then grows linearly in cost and latency. Writes above 4 MB are refused with HTTP 507.
- **Scores are trusted.** The client sends its own score; there is no server-side validation of a run, so the leaderboard can be cheated.
- **Names are not unique.** Two players can share a display name. Ranking is by GUID, so nothing collides, but the board can show duplicates.
- **GUID is the only credential.** `x-player-id` identifies the caller for backups. It is never returned by the leaderboard, but anyone who learns a GUID can overwrite that player's backup. A per-player secret or signed token is needed before this holds anything valuable.
- **No pruning.** Players who never come back stay in the file forever.

**What keeps working regardless.** The game is offline-first: the local save is the source of truth, nothing waits on the network, and a failing or unconfigured store answers 503 which the client ignores. The last submitted score and name are remembered on the device (`pista84.synced`) and retried on the next launch, run, rename, import or when the browser comes back online.

**Exit plan.** `PlayerStore` (`read`, `update`) is the only thing the handlers know about storage. Replace `blobStore` with a Redis (sorted set for ranks, hash per player) or Postgres implementation; no handler or client code needs to change. A real database also removes the per-operation quotas and the whole-file rewrites.

**Related leftovers**

- The Cloudflare D1 `player_progress` table (`db/schema.ts`, `drizzle/0001_*`) is no longer used by the code. `control_rooms` (phone pairing) still uses D1 on the Worker and the in-memory store locally.
- **Vercel functions setup (learned the hard way).** `vercel.json` must not use the legacy `builds` array: it names each function after its file *with* the extension (`/api/leaderboard.ts`), so every `/api/*` call returned 404. It uses `buildCommand` + `outputDirectory` instead and the `api/` folder is picked up automatically. **Never name a file like a server entrypoint.** Vercel's backend auto-detection looks for `app`, `index`, `server` and `main` (`.js/.ts` variants, in the repo root and in `src/`) and, if it finds one, deploys it as a Node function that answers `/` instead of the static site (the browser entry `src/app.ts` once crashed there with `location is not defined`). The search also covers the **build output directory** (`www/`), and runtime stack traces are source-mapped, so a crash in the browser bundle `www/app.js` showed up as `/var/src/app.ts` even after the source file was renamed. That is why the browser entry is `src/client.ts`, its bundle `www/game.js`, and the local server `dev-server.ts`; a test guards all of these names. `api/tsconfig.json` sets `types: []` because the function builder compiles from a temp directory where TypeScript 7 cannot find `@types/node` and then emits nothing. Reproduce the real build locally with `npx vercel build` (needs a throwaway `.vercel/project.json`) and look at `.vercel/output/functions`.

## TD-02 · Phone pairing rooms live in one serverless function's memory

**Decision.** `/api/rooms/**` (the QR code for "phone as controller") is served by a single function, `api/rooms.ts`, which keeps the rooms in a `memoryStore()`. `vercel.json` rewrites every sub-route to it as `/api/rooms?route=<rest>` because separate functions cannot share memory. The Worker keeps using D1 and `dev-server.ts` its own in-memory store.

It is not stored in Blob on purpose: a paired session makes about 10 calls a second (the main screen polls the room every 110 ms, the phone sends a heartbeat), so every call would cost a Blob operation and the free quota would be gone within minutes, starving the leaderboard.

**Known limits**

- **Instances do not share memory.** A cold start or a second instance in the middle of a pairing loses the room; the client then shows "Room expired. Generate a new QR code." and the player scans a new one. With one player on one device pair this is rare, under real traffic it will not be.
- **Invocation cost.** ~10 function invocations per second per paired session (about 36,000 an hour) count against the plan's invocation and compute quotas.
- **No relay guarantees.** The HTTPS fallback (used on Safari or when WebRTC cannot connect) depends on the same polling, so it is the first thing to degrade.
- **No TURN server** (roadmap NET-01), so WebRTC across some mobile networks falls back to that relay.

**Exit plan.** `RoomStore` (`src/server/signaling.ts`) is the only thing the pairing code knows about storage. Back it with Redis (keys with a ten-minute expiry) and rooms become shared across instances; polling could then also be replaced by server-sent events or WebSockets on a platform that supports them.

**Related leftovers**

- Verified only locally with `vercel build` and by calling the built function; try it on a preview deployment with a real phone.

## Setup

1. Create a private Blob store in the Vercel dashboard and connect it to the project with the `BLOB_STORAGE` prefix. Vercel then provides `BLOB_STORAGE_READ_WRITE_TOKEN` and `BLOB_STORAGE_STORE_ID` to the deployment; that is all the server needs.
2. For local runs put the same two values in `.env.local` (or run `vercel env pull .env.local`).
3. Run `npm run online:check`. It reads the ranking, writes a throwaway row and removes it again.

Without a token the online features are simply switched off (`/health` reports `cloudBackup: false`) and local runs keep players in memory.
