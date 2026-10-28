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
- Phone-controller pairing (`/api/rooms`, `/relay`) has no store on Vercel (serverless functions keep no memory and cannot hold WebSockets), so it only works on the Worker or `node server.ts`.
- `api/*.ts` and the `vercel.json` `builds`/`rewrites` entries were written against the Vercel docs but not yet deployed; verify on a preview deployment.

## Setup

1. Create a private Blob store in the Vercel dashboard and connect it to the project with the `BLOB_STORAGE` prefix. Vercel then provides `BLOB_STORAGE_READ_WRITE_TOKEN` and `BLOB_STORAGE_STORE_ID` to the deployment; that is all the server needs.
2. For local runs put the same two values in `.env.local` (or run `vercel env pull .env.local`).
3. Run `npm run online:check`. It reads the ranking, writes a throwaway row and removes it again.

Without a token the online features are simply switched off (`/health` reports `cloudBackup: false`) and local runs keep players in memory.
