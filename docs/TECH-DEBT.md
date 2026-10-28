# PISTA 84 — tech debt

## TD-01 · Online storage is one Vercel Global Config item

**Decision.** Everything online (leaderboard scores, player names, cloud backups) is stored as **one JSON document for all players** under the Global Config key `players`, keyed by each player's permanent GUID. Code: `src/server/players.ts` (rules), `src/server/global-config.ts` (store), `src/server/cloud.ts` (HTTP handlers), `api/*.ts` (Vercel functions).

It was chosen to get an online leaderboard running without provisioning a database. It is a stop-gap. Global Config is a read-optimised configuration store, not a database.

**Known limits**

- **Size cap.** The whole document must fit the plan limit (roughly 8 KB hobby, 64 KB pro, as last known; verify). Scores alone are about 120 bytes per player; a cloud backup adds a few hundred. Writes above `GLOBAL_CONFIG_MAX_BYTES` (default 8000) are refused with HTTP 507. Expect to hit this at tens of players.
- **Last writer wins.** Every write re-reads the document and rewrites all of it. Two runs finishing at the same moment can drop one update. There are no transactions.
- **Write path is slow and rate-limited.** Writes go through the Vercel management API with `VERCEL_API_TOKEN` and take time to propagate to the edge, so a leaderboard read right after a write can be stale.
- **Scores are trusted.** The client sends its own score; there is no server-side validation of a run, so the leaderboard can be cheated.
- **Names are not unique.** Two players can share a display name. Ranking is by GUID, so nothing collides, but the board can show duplicates.
- **GUID is the only credential.** `x-player-id` identifies the caller for backups. It is never returned by the leaderboard, but anyone who learns a GUID can overwrite that player's backup. A per-player secret or signed token is needed before this holds anything valuable.
- **No pruning.** Players who never come back stay in the document forever.

**What keeps working regardless.** The game is offline-first: the local save is the source of truth, nothing waits on the network, and a failing or unconfigured store answers 503 which the client ignores. The last submitted score and name are remembered on the device (`pista84.synced`) and retried on the next launch, run, rename, import or when the browser comes back online.

**Exit plan.** `PlayerStore` (`read`, `update`) is the only thing the handlers know about storage. Replace `globalConfigStore` with a Redis (sorted set for ranks, hash per player) or Postgres implementation; no handler or client code needs to change. Keep Global Config for what it is good at: small, rarely-edited settings such as the coin override.

**Related leftovers**

- The Cloudflare D1 `player_progress` table (`db/schema.ts`, `drizzle/0001_*`) is no longer used by the code. `control_rooms` (phone pairing) still uses D1 on the Worker and the in-memory store locally.
- Phone-controller pairing (`/api/rooms`, `/relay`) has no store on Vercel (serverless functions keep no memory and cannot hold WebSockets), so it only works on the Worker or `node server.ts`.
- `api/*.ts` and the `vercel.json` `builds`/`rewrites` entries were written against the Vercel docs but not yet deployed; verify on a preview deployment.

## Setup

1. Create a Global Config (Storage tab) and connect it to the project; Vercel sets `GLOBAL_CONFIG`.
2. Create a Vercel API token and add it as `VERCEL_API_TOKEN` (and `VERCEL_TEAM_ID` for team projects).
3. Optional: raise `GLOBAL_CONFIG_MAX_BYTES` to match the plan.

Without these variables the online features are simply switched off (`/health` reports `cloudBackup: false`).
