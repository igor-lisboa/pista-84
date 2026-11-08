# Online storage and maintenance

## Ownership

| Data | Storage | Lifetime |
| --- | --- | --- |
| Scores, display names, best distance and timestamps | MongoDB `scores`, `_id` = player GUID | Durable, no TTL |
| Manual progress backups and revisions | MongoDB `backups`, `_id` = player GUID | Durable, no TTL |
| Automatic offline progress snapshots | MongoDB `device-backups`, `_id` = player GUID + device GUID | Durable, no TTL |
| Pairing offer, host/join tokens and claimed answer | Redis `pista84:room:{id}` hash | 10 minutes from creation |
| Latest controller input and timestamp | Redis `pista84:room:{id}:input` | 2 seconds, capped by remaining room TTL |
| Socket presence and reconnect ownership | Redis `pista84:room:{id}:host` / `:controller` | 15 seconds, renewed every 5 seconds, capped by room TTL |
| Offline save, preferences, pending score and progress synchronization | Browser localStorage / exported save | Device-owned, works without network |
| Live WebSocket handles | Accepting Node/Vercel instance | Disconnect, room expiry or function duration limit |

MongoDB is the durable online source. Redis never stores backups or authoritative
scores. There is no leaderboard read cache: indexed MongoDB queries provide fresh
pages without cache invalidation races. Socket handles cannot be serialized into
Redis. `/api/controller` uses Redis Pub/Sub to deliver commands across instances;
HTTP only creates, claims and deletes rooms. The unused local `/relay` was removed.

## Configuration and deployment

Use Node 24+. Set `MONGODB_URI` and `REDIS_URL` on the Node/Vercel deployment.
Local scripts load `.env.local`, then `.env`; existing process values take precedence.
`MONGODB_DATABASE` defaults to `pista84` (the URI database path is deliberately not
used). Use `rediss://` when your Redis provider requires TLS. Keep credentials out
of browser config, Git, logs and screenshots.

`npm run online:check` exercises scores, manual/device backup isolation and revision conflicts, exclusive room
claims, controller input and Redis TTLs. It uses random probe IDs and removes its
records in `finally`; MongoDB and Redis cleanup are attempted independently. This
is an explicit live-service check; normal Node/browser tests do not load `.env` or
write to live services. If a process is forcibly terminated, remove only the known
probe GUID from `scores`/`backups` and its player/device key from `device-backups`;
Redis probes expire on their own.

The MongoDB account needs read/write and index creation permission on the selected
database. The driver reuses a pool of up to five connections per instance and creates
the ranking index `{score: -1, achieved: 1, _id: 1}`. Writes require majority
acknowledgment. Equal score/achievement timestamps are ordered by GUID for stable
pagination. Redis needs hashes, strings,
expiry, deletion, `EVAL`, `PUBLISH`, `SUBSCRIBE` and `UNSUBSCRIBE`. Scripts use shared
hash tags for Cluster compatibility. Socket instances share one command connection
and a separate Pub/Sub connection; they never poll Redis for controller input.

Vercel runs `api/*.ts` in Node; the development server uses the same adapters.
`api/controller.ts` exports an HTTP server with the `ws` upgrade handler, following
[Vercel's WebSocket API](https://vercel.com/docs/functions/websockets). No extra
socket hosting service or browser Redis credentials are needed. Function duration
limits still apply: clients reconnect with bounded backoff and the same session.
Verify the WebSocket upgrade after deployment; local tests cannot certify Vercel routing.
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

### Automatic local-save migration and synchronization

On launch, the game normalizes the existing `pista84` local save and persists any
new identity assigned to a legacy save. It queues that snapshot before applying
the environment balance override. No score or username is required to migrate.
Every subsequent local persist also updates a durable local outbox. Upload runs
on launch, every 30 seconds, on reconnect and best-effort on page exit. Offline
failures leave the outbox for the next attempt or browser launch. Saves for a
retired player remain queued when a new player starts.

`src/net/progress-sync.ts` serializes uploads through
`GET/PUT /api/progress?device=<device-guid>`. Acknowledged snapshots are remembered
locally so unchanged saves are not repeatedly uploaded. Changes made during an
upload remain queued. Each device has its own latest durable snapshot, isolated
from other devices and from manual backups. Revisions reject racing writes;
older save timestamps cannot replace newer snapshots on the same device.

Automatic uploads never restore or merge server data into active local play.
The existing garage buttons continue to manage the explicit manual backup in
`backups`. Automatic snapshots are readable through the device-scoped progress
API for recovery; a cross-device snapshot picker is not implemented. Storage
failure prevents persistence of the outbox but still permits in-session upload.
Players must revisit the updated game while connected for existing local data
to reach MongoDB; a closed/offline browser cannot be uploaded remotely.

Backend responsibilities are separated for maintenance:

- `mongo-store.ts`: connection lifetime and index initialization.
- `mongo-player-store.ts`: database reads, writes and optimistic concurrency.
- `players.ts`: score and backup business rules; `leaderboard.ts`: shared pagination and public response mapping.
- `redis.ts`: connection lifetime; `redis-rooms.ts`: atomic room operations and TTLs.
- `redis-sockets.ts`: atomic presence ownership, input publication and Pub/Sub subscriptions.
- `room-sockets.ts` / `socket-session.ts`: upgrade validation and authenticated socket lifecycle.
- `src/net/room-socket.ts`: browser socket lifecycle; `remote.ts`: pairing and controller commands.
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
game progress, not a trusted paid wallet. Stronger authentication and anti-cheat
remain future work. WebSocket delivery works across instances;
direct WebRTC/TURN transport is no longer part of the active client.

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
