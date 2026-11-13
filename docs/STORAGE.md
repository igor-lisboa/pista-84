# Online storage and maintenance

## Ownership

| Data | Storage | Lifetime |
| --- | --- | --- |
| Scores, display names, best distance and timestamps | MongoDB `scores`, `_id` = player GUID | Durable, no TTL |
| Legacy manual progress backups and revisions (read by the server; the game no longer writes them) | MongoDB `backups`, `_id` = player GUID | Durable, no TTL |
| Automatic offline progress snapshots | MongoDB `device-backups`, `_id` = player GUID + device GUID | Durable, no TTL |
| Account credentials and unique normalized usernames | MongoDB `accounts`, `_id` = server-issued account GUID | Durable, no TTL |
| Merged account progress | MongoDB `account-progress`, `_id` = account GUID | Durable, separate from manual/device backups |
| Hashed account sessions | MongoDB `sessions`, `_id` = SHA-256 of random session token | 30 days; TTL cleanup plus expiry checks on reads |
| Shared authentication attempt budgets | MongoDB `auth-attempts` | Fixed windows; TTL cleanup |
| Pairing offer, host/join tokens and claimed answer | Redis `pista84:room:{id}` hash | 10 minutes from creation |
| Latest controller input and timestamp | Redis `pista84:room:{id}:input` | 2 seconds, capped by remaining room TTL |
| Socket presence and reconnect ownership | Redis `pista84:room:{id}:host` / `:controller` | 15 seconds, renewed every 5 seconds, capped by room TTL |
| Live controller events between instances | Redis Pub/Sub channel `pista84:room:{id}:events` | Not stored; delivered to current subscribers only |
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
the ranking index `{score: -1, achieved: 1, _id: 1}`, a unique account index
`{usernameKey: 1}`, session lookup index `{accountId: 1}`, and TTL indexes on
`sessions.expires` and `auth-attempts.expires` with `expireAfterSeconds: 0`.
Account progress and backups use MongoDB's existing unique `_id` indexes; no
additional scan index is needed for those keyed reads. Writes require majority
acknowledgment. Equal score/achievement timestamps are ordered by GUID for stable
pagination. Redis needs hashes, strings,
expiry, deletion, `EVAL`, `PUBLISH`, `SUBSCRIBE` and `UNSUBSCRIBE`. Scripts use shared
hash tags for Cluster compatibility. Socket instances share one command connection
and a separate Pub/Sub connection; they never poll Redis for controller input.

Vercel runs `api/*.ts` in Node; the shared Node HTTP/WebSocket server uses the same adapters.
`api/controller.ts` exports an HTTP server with the `ws` upgrade handler, following
[Vercel's WebSocket API](https://vercel.com/docs/functions/websockets). No extra
socket hosting service or browser Redis credentials are needed. Function duration
limits still apply: clients reconnect with bounded backoff and the same session.
Verify the WebSocket upgrade after deployment; local tests cannot certify Vercel routing.
No MongoDB means cloud endpoints return 503 and cloud backup is disabled. No Redis
means deployed pairing returns 503. Only the local development server may fall back
to memory pairing for offline development; it never offers volatile cloud saves.
Configured service failures return 503 without erasing browser progress.
`/health` reports configuration availability, not a live database ping: `{ok, cloudBackup, storage, pairing}`, where
`cloudBackup` means MongoDB is configured and `pairing` is `redis` (or `unconfigured`/`memory` locally). Use
`online:check` for read/write verification.

### Local Docker stack

`docker-compose.yml`, `Dockerfile`, `.dockerignore` and `scripts/local.sh` run the game with its own
MongoDB 7 and Redis 7 containers. The only requirements are Docker with Compose 2.24 or newer and a
bash shell (Git Bash on Windows); Node, MongoDB and Redis are not needed on the host.

- `bash scripts/local.sh up` copies `.env.example` to `.env.docker` (ignored by Git), rewriting
  `MONGODB_URI` to `mongodb://mongo:27017`, `REDIS_URL` to `redis://redis:6379`, `MONGODB_DATABASE` to
  `pista84`, and clearing `PISTA84_COINS`, `API_ORIGIN` and `PUBLIC_ORIGIN`. It then builds the image,
  starts the three services, waits for their health checks and prints `http://localhost:4173`.
  An existing `.env.docker` is kept (it may hold your edits); `--force-env` regenerates it,
  `--port N` changes the port and `--lan` publishes on all interfaces for a phone.
- The app container runs `dev-server.ts` with `NODE_ENV=development`: plain HTTP, so accounts and
  cookies work on `http://localhost`. Compose pins `MONGODB_URI` and `REDIS_URL` to the service names,
  so neither `.env.docker` nor the host shell can point this stack at real databases.
- MongoDB and Redis are not published to the host. MongoDB data lives in the named volume
  `pista84-local_pista84-mongo` (`down` keeps it, `reset` deletes it); Redis has no persistence. The game is
  published on `127.0.0.1` unless `--lan` is given.
- `bash scripts/local.sh check` runs `npm run online:check` and `scripts/check-local.ts` inside the app
  container. The latter drives the real HTTP and WebSocket server with one throwaway account (health,
  runtime config, static assets, guest 401s, signup/duplicate/login, score and leaderboard, progress
  revisions with 409, device snapshot isolation, `PUT /api/account`, room creation and exclusive claim,
  controller input over WebSocket through Redis, logout) and removes its records in `finally`. It refuses
  to run unless `MONGODB_URI` and `REDIS_URL` point to local hosts and never loads `.env` files.
  `bash scripts/local.sh test` adds `npm run typecheck` and `npm test`. None of this is part of `npm test`.
- Limits: `/network` reports the container address, so for phone pairing open the game on the computer
  through its LAN address (`http://<lan-ip>:4173`, started with `--lan`) before generating the QR.
  Tilt and secure cookies need HTTPS, which this stack does not provide. It is a development
  convenience, not a deployment descriptor: Heroku and Vercel do not use these files.

### Heroku

Use the Node.js buildpack with the repository's Node 24 engine. Heroku runs
`heroku-postbuild` to generate assets while build dependencies are available, then
the `Procfile` runs `npm start` (`node production-server.ts`). Startup never
rebuilds assets or loads local `.env` files. `npm run dev` remains the local
build-and-serve command. Both launchers use `scripts/node-server.ts`.

Set these in **Settings > Config Vars**:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PUBLIC_ORIGIN` | `https://pista-84-e7d109005460.herokuapp.com` (no path) |
| `MONGODB_URI` | Your provider's MongoDB connection URI, including credentials |
| `MONGODB_DATABASE` | `pista84`, or the database your account can access |
| `REDIS_URL` | Your provider's Redis connection URI; use `rediss://` for TLS |
| `PISTA84_PROGRESS_TOOLS` | Boolean `true` (default) or `false`; false hides the garage file export/import controls. Automatic saves/sync remain enabled. |
| `PISTA84_COINS` | Omit for normal saved balances; setting it overrides every player's balance |

Do not set `PORT`: Heroku assigns it. Leave `API_ORIGIN` unset on this dyno;
only an optional separate edge Worker needs it, pointing to this HTTPS origin.
MongoDB/Redis add-on variables with other names must be mapped to
`MONGODB_URI`/`REDIS_URL`; the app does not read provider-specific aliases.
Do not place actual credentials in commands, repository files or screenshots.

Production refuses to listen if MongoDB or Redis is unconfigured; there is no
deployed memory fallback. Configure both before deploying. The listener binds
to `0.0.0.0:$PORT`, and `/api/controller` handles WebSocket upgrades on the same
dyno. Heroku terminates TLS at its router: `PUBLIC_ORIGIN` pins the external
origin, or the server uses Heroku's `X-Forwarded-Proto` header when it is unset.
Same-origin API protection stays enabled. Production does not publish `/network`.

The reported room POST 403 with `{"error":"Invalid origin."}` results when HTTPS
browser requests are reconstructed as HTTP internally, or `PUBLIC_ORIGIN` points
to a different hostname. Progress GET 503 with
`{"error":"Online storage is not configured."}` means `MONGODB_URI` is absent.
Configured but unreachable/unauthorized MongoDB also returns 503, with a different
generic message: check the database user's permissions and provider network
access rules. `/health` cannot certify connectivity.

After deployment, check `/health`, reload the game and verify progress uploads,
room creation and a WebSocket 101 upgrade on `/api/controller`. Run
`npm run online:check` only in an explicitly configured maintenance environment
when live read/write verification is needed; it uses removable probe records.

The optional edge Worker is browser-targeted and cannot run these TCP drivers.
It serves assets and forwards `/api/*` and `/health` to an HTTPS `API_ORIGIN`
pointing at the Node/Vercel deployment. Set this separately in Worker runtime
configuration; it is not embedded from `.env`. Missing backend configuration returns
503. Same-origin checks run before forwarding, and user tokens are not cached.

## Consistency

### Optional accounts and account reconciliation

The static game and Canvas simulation remain offline-capable. Next.js is not a
dependency: server rendering would not remove the browser simulation, and the
current static PWA/Capacitor/edge packaging remains supported. Sensitive work is
already performed by Node APIs. All Node/Vercel player entrypoints use
`player-api.ts` for account authorization before the existing score/backup rules.
The entry script loads the game or phone controller on demand; controllers avoid
downloading the game renderer. Build-generated chunk lists keep the PWA's lazy
modules available offline.

Settings > Account shows the signed-in pilot with a change-password form and log out (or offers log in / sign up).
`POST /api/auth` with `action: "password"` needs a session and the current password, shares the
per-account login attempt budget, replaces the hash, revokes every session of the account and
issues a fresh one for the calling device.
The first-launch screen asks for a driver name and password: that creates the account,
so the same progress can be used on other devices. Players with an account switch to login
on the same screen. Progress is merged with the device's offline save at that moment.
Guests (no signed-in session) never contact the online API: no score, progress, backup or
health requests, and no leaderboard publication. The leaderboard is only for signed-in players: guests see a short message instead of the ranking and no request is made.
The server rejects `/api/score` and `/api/progress` writes without a session (HTTP 401).
Account creation is optional on first launch: "Play without an account" keeps the player a guest with no
name and no upload, and the account can be created later from Settings. Guest play works without an
account or network, and the first-launch screen never blocks on the account service. Legacy guest GUID records stay in
MongoDB, but a GUID header never authorizes a score or progress write without a session and
does not establish ownership of an account. New account GUIDs are
server-issued, and existing guest GUIDs/names never become account credentials.
There is no automatic account claim based on a leaderboard name. Existing guest
display names are not reserved account names, but a submission for a GUID that is not
the session's own account cannot use a registered username (HTTP 409 `Username is reserved.`). A signed-in pilot always uses the account username, including
on launch and after import/restore. Signup rejects an existing normalized username
with HTTP 409 (`taken`); the form explains that the pilot name/username is in use
and focuses the name field to choose another. Historical leaderboard rows are retained.

`POST /api/auth` accepts JSON `{action: "signup" | "login", username, password}`
or `{action: "logout"}`. `GET /api/auth` returns only `{user: {id, username} | null}`.
Usernames are canonical lower case: NFKC-normalized, trimmed and lower-cased, then
3–16 characters of `a-z`, `0-9`, `_` and `-` only (no spaces, dots, accents or
emoji), starting and ending with a letter or digit, with no doubled `_`/`-` and
no reserved names (`admin`, `root`, `system`, ...). The same `normalizeUsername`
rules run in the browser and the API; the form cleans text while typing. Uniqueness is
enforced by MongoDB's unique index even for concurrent registrations. Account
renaming and password recovery are not implemented.

Passwords are 5–128 Unicode characters, without composition rules or truncation.
Node's asynchronous scrypt uses N=131072, r=8, p=1, a random 16-byte salt and a
64-byte key; comparisons use `timingSafeEqual`. Only the versioned salt/hash
encoding is stored. Passwords are never logged, returned, cached or persisted in
browser storage. Password work is capped at two concurrent derivations per
instance. MongoDB shares budgets of ten attempts per normalized name per
15-minute window and 300 total attempts per minute across instances. Unknown
users incur the same derivation cost as an incorrect password. Authentication
fails closed with 503 on storage errors; there is no memory account fallback.

Sessions use 32 random bytes. MongoDB stores only their SHA-256 digests. HTTPS
uses a host-only `__Host-pista84-session` cookie with Secure, HttpOnly,
SameSite=Strict and Path=/; local HTTP development uses `pista84-session`.
Deploy accounts behind HTTPS and configure `PUBLIC_ORIGIN` correctly. The browser
refuses to send login/signup credentials over HTTP except on loopback development
hosts, and production APIs reject HTTP account requests. Login
rotates the browser's previous session; logout deletes only that device's
session. Other devices remain signed in. Expired sessions cannot authorize reads
even before TTL deletion. Mutations check Origin and reject cross-site fetches;
credential mutations require JSON. The edge proxy forwards only game session
cookies and preserves Set-Cookie; neither the proxy nor the service worker caches
account responses. Every account score/backup read or write requires the matching
session, regardless of a supplied GUID. Account names on writes come from MongoDB.

After authentication, `PUT /api/account` sends `{save}` once and atomically
reconciles the guest/local save with `account-progress` using the existing CAS
adapter. Scores/distances take maxima, unlocks form a union, creation takes the
earliest time and tutorial completion is retained. A guest merge keeps the larger
coin balance, rather than adding duplicate balances. For subsequent account
snapshots, the later save timestamp wins for coins and selections so purchases
can reduce the balance. Preferences follow the later snapshot. Retired-player
history is not imported into an account. Repeated unchanged reconciliation does
not add coins. Concurrent merges retry against the latest account document.
The account's highest published score/distance must remain intact.

The browser adopts the account identity and acknowledges the old guest outbox
only after reconciliation succeeds. Failed responses leave guest data intact
and offer a retry using the established session. Expired sessions offer login
to the same account; its offline play remains available. Later successful
progress writes by the account GUID also reconcile account progress. Automatic uploads
remain confined to launch/pause/end/menu/exit events; explicit account login/sync is a
user-triggered exception. These background uploads do not replace the active
in-memory save. Login or explicit account sync restores the combined cloud save.
Device snapshots and legacy manual backups keep their separate records and revisions.

Logout attempts the last account snapshot, revokes the server session and then
clears all `pista84`/`pista84.*` records on this device, including outboxes,
acknowledgements, history and the device GUID. It creates a fresh, empty guest
save carrying only language, sound and units. In-flight progress uploads are
aborted and stale replies cannot recreate local data; other tabs reload when
the account marker changes. An unavailable logout endpoint leaves the device
data intact and reports failure so a still-active session is not silently left
behind. Explicit logout can discard unsynced progress if the final merge fails;
the account screen explains this before the action. Cloud account records remain
available on the next login; logout is not account deletion.

Accounts add no environment variables or external auth provider. Deploy source,
ensure MongoDB permits index creation and serve APIs over HTTPS. Index creation
runs on first database use and failures become guarded 503 responses. Normal
tests use isolated account/player stores; the account browser tests route to the
same production API functions with those fakes and never touch live services.

### Automatic local-save migration and synchronization

Before every local write (and before banking race earnings) the game re-reads the stored save. If another
tab or a restore wrote a newer copy of the same player, it is folded in with `reconcileStoredSave`
(later snapshot wins coins and selections, records take the maximum, unlocks are unioned) so a late write
such as the one on page exit never discards it. A stored save of a different player is never overwritten.

On launch, the game normalizes the existing `pista84` local save and persists any
new identity assigned to a legacy save. It queues that snapshot before applying
the environment balance override. No score or username is required to migrate.
Every subsequent local persist also updates a durable local outbox. Five-second
racing autosaves are local-only. For signed-in devices, automatic progress and score
uploads run on first entry (launch), pause, game end (crash or fuel exhaustion), return to
the menu and best-effort page exit/backgrounding. There are no periodic or reconnect uploads
and no sync buttons. Guests upload nothing.
A one-time launch `/health` check (signed-in players only) confirms that cloud storage is configured
before scores are published; runtime config, the leaderboard and the controller WebSocket remain available.
Resuming play prevents a pending revision lookup from starting its PUT or a
queued retry; unsent snapshots stay local until the next permitted event. Offline
failures leave the outbox and score acknowledgement marker unchanged for that
next event, including after a browser restart. Saves for a
retired player remain queued when a new player starts.

`src/net/progress-sync.ts` serializes uploads through
`GET/PUT /api/progress?device=<device-guid>`. Acknowledged snapshots are remembered
locally so unchanged saves are not repeatedly uploaded. Changes made during an
upload remain queued. Each device has its own latest durable snapshot, isolated
from other devices and from manual backups. Revisions reject racing writes;
older save timestamps cannot replace newer snapshots on the same device.

Automatic uploads never restore or merge server data into active local play.
Explicit account login/sync reconciles account data as described above.
Garage export/import remains for offline files. The manual cloud backup buttons were removed;
the `backups` collection is still read by the server but no longer written by the game.
Leaderboard reads retire guest rows that duplicate a registered pilot's name and are not
better than the account row (at most once a minute per instance). Merging a guest into an
account moves that guest's best score onto the account and deletes the guest row, but only when the
guest row carries the account's own name: a GUID alone cannot delete another pilot's row. Automatic snapshots are readable through the device-scoped progress
API for recovery; a cross-device snapshot picker is not implemented. Storage
failure prevents persistence of the outbox but still permits in-session upload.
Players must revisit the updated game and pause/end/leave while connected for
existing local data to reach MongoDB; a closed/offline browser cannot be uploaded
remotely. Page-exit upload is best-effort, never a prerequisite for a local save.

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

Scores remain client-reported. Legacy guest GUID rows are not credentials any more:
account records and all score/progress writes require sessions, but this is casual game progress, not a trusted
paid wallet. Timestamp-based reconciliation is not a currency ledger or anti-cheat
system; edited saves and device clock skew remain limitations. Password recovery,
email verification, MFA, account deletion and remote logout of all devices are
not implemented. Native builds require a separately verified same-origin HTTPS
API/cookie setup; packaged static assets alone do not provide an account backend.
WebSocket delivery works across instances;
direct WebRTC/TURN transport is no longer part of the active client.

## AI maintenance entrypoints

`AGENTS.md` is the shared policy and Codex entrypoint; `CLAUDE.md` imports it and
`.github/copilot-instructions.md` routes Copilot to it. Canonical task workflows
live in `.agents/skills/`; `.claude/skills/` and `.github/skills/` provide discoverable
entrypoints without duplicating the workflows. Claude/Copilot maintenance roles
live in `.claude/agents/` and `.github/agents/`. Update canonical guidance first.

The skills are `pista-game`, `pista-storage` and `pista-docs`; the agents are
`pista-maintainer` and `pista-docs`. `specs/` and `docs/` are the source of truth:
`pista-docs` requires every behavior, data, API, text, catalog or test change to
update the affected pages, the requirements matrix and the baseline in
`specs/README.md` in the same change, and describes the audit procedure.

Formats follow [Codex instructions](https://developers.openai.com/codex/guides/agents-md),
[Codex skills](https://developers.openai.com/codex/skills),
[Claude skills](https://code.claude.com/docs/en/skills),
[Claude subagents](https://code.claude.com/docs/en/sub-agents), and
[Copilot customizations](https://docs.github.com/en/copilot/concepts/customizations/comparing-customizations).
