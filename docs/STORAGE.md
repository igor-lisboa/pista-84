# Online storage and maintenance

## Ownership

| Data | Storage | Lifetime |
| --- | --- | --- |
| Scores, display names, best distance and timestamps | MongoDB `scores`, `_id` = player GUID | Durable, no TTL |
| Manual progress backups and revisions | MongoDB `backups`, `_id` = player GUID | Durable, no TTL |
| Pairing offer, host/join tokens and claimed answer | Redis `pista84:room:{id}` hash | 10 minutes from creation |
| Latest controller input and timestamp | Redis `pista84:room:{id}:input` | 2 seconds, capped by remaining room TTL |
| Offline save, preferences, pending score synchronization | Browser localStorage / exported save | Device-owned, works without network |
| Local WebSocket handles | Node process memory | Disconnect or 1 hour; swept every minute |

MongoDB is the durable online source. Redis never stores backups or authoritative
scores. There is no leaderboard read cache: indexed MongoDB queries provide fresh
pages without cache invalidation races. Socket handles cannot be serialized into
Redis; `/relay` remains a local-only transport, while shared HTTP pairing uses Redis.

## Configuration and deployment

Use Node 24+. Set `MONGODB_URI` and `REDIS_URL` on the Node/Vercel deployment.
Local scripts load `.env.local`, then `.env`; existing process values take precedence.
`MONGODB_DATABASE` defaults to `pista84` (the URI database path is deliberately not
used). Use `rediss://` when your Redis provider requires TLS. Keep credentials out
of browser config, Git, logs and screenshots.

`npm run online:check` exercises scores, backup revision conflicts, exclusive room
claims, controller input and Redis TTLs. It uses random probe IDs and removes its
records in `finally`; MongoDB and Redis cleanup are attempted independently. This
is an explicit live-service check; normal Node/browser tests do not load `.env` or
write to live services. If a process is forcibly terminated, remove only the known
probe GUID from `scores`/`backups`; Redis probes expire on their own.

The MongoDB account needs read/write and index creation permission on the selected
database. The driver reuses a pool of up to five connections per instance and creates
the ranking index `{score: -1, achieved: 1, _id: 1}`. Writes require majority
acknowledgment. Equal score/achievement timestamps are ordered by GUID for stable
pagination. Redis needs hashes, strings,
expiry, deletion and `EVAL`. Scripts use shared hash tags for Cluster compatibility.

Vercel runs `api/*.ts` in Node; the development server uses the same adapters.
No MongoDB means cloud endpoints return 503 and cloud backup is disabled. No Redis
means deployed pairing returns 503. Only the local development server may fall back
to memory pairing for offline development; it never offers volatile cloud saves.
Configured service failures return 503 without erasing browser progress.
`/health` reports configuration availability, not a live database ping. Use
`online:check` for read/write verification.

The optional edge Worker is browser-targeted and cannot run these TCP drivers.
It serves assets and forwards `/api/*` and `/health` to an HTTPS `API_ORIGIN`
pointing at the Node/Vercel deployment. Set this separately in Worker runtime
configuration; it is not embedded from `.env`. Missing backend configuration returns
503. Same-origin checks run before forwarding, and user tokens are not cached.
The historical D1 schema/migrations are retained for reference, not used by the runtime.

## Consistency

Backend responsibilities are separated for maintenance:

- `mongo-store.ts`: connection lifetime and index initialization.
- `mongo-player-store.ts`: database reads, writes and optimistic concurrency.
- `players.ts`: score and backup business rules; `leaderboard.ts`: shared pagination and public response mapping.
- `redis.ts`: connection lifetime; `redis-rooms.ts`: atomic room operations and TTLs.
- `tests/support/memory-player-store.ts`: isolated test double, never application storage.

Each MongoDB document contains `_id`, internal CAS `version` and `value`. Score
documents also mirror `score` and `achieved` for indexed sorting/ranking. `value`
is a one-row score array or a one-player backup map, preserving the domain format.
Writes compare the internal version and retry contention up to 12 times; duplicate
first-insert races retry as well. Identical submissions do not write. Callbacks
must have no external side effects because they may run repeatedly.

Backup revisions are the public concurrency contract: a stale write returns 409.
Score and backup updates are separate durable operations, not one transaction;
if score publication fails after a backup commits, read the backup before retrying
and use its current revision. No Redis cache can hide a newer backup revision.

Room creation and its relative TTL are one atomic script. Answer claims use
`HSETNX` on the existing room, so exactly one controller wins. Input writes check
the answered room and remaining lifetime atomically; they cannot resurrect a
deleted room, overwrite a newer command or outlive the room. Reads report input
as absent after expiration, and the client already pauses on signal loss.

## Existing data and limitations

This code change does not import records from the previous storage provider or
delete remotely stored data. New deployments read MongoDB. If existing online
data must be preserved, import an offline export into the new record format
before switching traffic; browser saves and manual exports remain available.
Uninstall/disconnect the old remote service separately after retaining any data
you need. No old provider credentials or SDK are required by this project.

Scores remain client-reported and GUIDs remain backup credentials. This is casual
game progress, not a trusted paid wallet. Stronger authentication, anti-cheat,
TURN support and a cross-instance WebSocket relay remain future work.

## AI maintenance entrypoints

`AGENTS.md` is the shared policy and Codex entrypoint; `CLAUDE.md` imports it and
`.github/copilot-instructions.md` routes Copilot to it. Canonical task workflows
live in `.agents/skills/`; `.claude/skills/` and `.github/skills/` provide discoverable
entrypoints without duplicating the workflows. Claude/Copilot maintenance roles
live in `.claude/agents/` and `.github/agents/`. Update canonical guidance first.

Formats follow [Codex instructions](https://developers.openai.com/codex/guides/agents-md),
[Codex skills](https://developers.openai.com/codex/skills),
[Claude skills](https://code.claude.com/docs/en/skills),
[Claude subagents](https://code.claude.com/docs/en/sub-agents), and
[Copilot customizations](https://docs.github.com/en/copilot/concepts/customizations/comparing-customizations).
