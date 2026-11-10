# 06 — Architecture, persistence and packaging

[Specification index](README.md)

## Workspace layout

```text
car-game/
  README.md, AGENTS.md, CLAUDE.md
  specs/                 canonical game definitions
  docs/                  storage/deployment guide, tuning notes, art provenance, screenshots
  src/
    game/                pure simulation and save rules, no DOM
    render/              Canvas renderer, scenery, sprites
    audio/               Web Audio engine, procedural music
    i18n/                translator and locales
    ui/                  screens, HUD, input, dialogs
    net/                 account client, progress sync, phone-controller client
    server/              accounts, scores, backups, room signaling, MongoDB/Redis adapters
    shared/              public runtime config
    client.ts, qr.ts     browser entry point, QR generation
  api/                   Vercel Node functions (one per public endpoint) plus _rooms.ts/_store.ts helpers
  web/                   HTML, CSS, PWA files, sw.ts and artwork
  worker/                optional edge Worker (generated-assets.ts is build output)
  tests/                 Node tests, test support, Playwright specs (tests/browser)
  scripts/               build, env, Node server, assets, screenshots, verification (TypeScript) and local.sh (Docker stack)
  dev-server.ts          local Node launcher
  production-server.ts   production Node launcher
  Dockerfile, docker-compose.yml, .dockerignore   local Docker stack: game + MongoDB + Redis (not a deployment)
  tsconfig.json, playwright.config.ts, vercel.json, Procfile, app.json, capacitor.config.json
  .env.example           documented configuration (real .env is ignored by Git; .env.docker is generated from it)
  .gitattributes         forces LF for *.sh and the Dockerfile
  .agents/, .claude/, .github/   shared AI maintenance skills, agents and instructions
  android/ and ios/      generated Capacitor projects
  www/                   generated browser/native assets (ignored)
  dist/                  generated hosted Worker (ignored)
```

The canonical `specs/` lives at the repository root, next to the application source. `docs/` holds the storage/deployment guide ([STORAGE.md](../docs/STORAGE.md)), tuning notes and art provenance/screenshots.

## TypeScript toolchain

All source is TypeScript; no JavaScript or `.mjs` remains. Node.js **24** runs `.ts` files directly through type stripping, so only **erasable syntax** is allowed (`erasableSyntaxOnly`: no enums, namespaces or parameter properties) and relative imports carry a `.ts` extension (`allowImportingTsExtensions`). `tsc --noEmit -p .` (`npm run typecheck`, strict mode) is the typechecker for `api`, `src`, `tests`, `scripts`, `worker`, `web/sw.ts`, `dev-server.ts`, `production-server.ts` and `playwright.config.ts`. **esbuild** bundles the browser app (`src/client.ts` → `www/game.js` plus shared chunks under `www/chunks/`, ESM) and the service worker (`web/sw.ts` → `www/sw.js`, IIFE), both targeting **es2019**, and the Worker (`worker/index.ts` → `dist/server/index.js`). Code, comments, identifiers, test names and server/API error messages are English; player-facing text lives in `src/i18n/locales/*.ts`.

## Module responsibilities

| Module | Responsibility |
| --- | --- |
| `src/game/cars.ts` | 18-vehicle catalog (`CarSpec`, `Purchase`), paints, defaults |
| `src/game/race.ts` | `Race`: states, driving, off-road penalties, crashes, score, coins, checkpoints, fuel, second chance, spawning |
| `src/game/traffic.ts` | Traffic and fuel entities: ramp, late-game pressure, waves, lane changes, following, separation |
| `src/game/road.ts` | Seeded stateless road curve plus lane/camera geometry constants |
| `src/game/scoring.ts` | `paceMultiplier` |
| `src/game/vehicle-tuning.ts` | Per-vehicle acceleration gain/falloff, width, braking rate and brake squeal |
| `src/game/environment.ts` | Light and weather as a function of run time and the run's rolled conditions |
| `src/game/save.ts` | `SaveData` (v2), `loadSave` sanitising, `importSave`, `PISTA84_COINS` override |
| `src/game/merge-progress.ts` | `mergeProgress` (guest/account reconciliation) and `reconcileStoredSave` (newer local copy from another tab) |
| `src/game/username.ts`, `units.ts` | Username rules and GUID helpers shared by browser and API; km/mi conversion |
| `src/game/index.ts`, `math.ts` | Public barrel, `clamp` |
| `src/render/renderer.ts` | Responsive perspective, road, scene projection, environment effects, shake and overlays |
| `src/render/scenery.ts`, `billboards.ts`, `noise.ts`, `color.ts` | Cached city, clouds, trees, lamps, billboards and their ad texts, deterministic hash, color helpers |
| `src/render/sprites.ts`, `procedural-cars.ts` | Atlas loading/trimming, paints, turn frames; procedural sprites used as loading fallback |
| `src/audio/audio.ts` | `AudioEngine`: 18 engine profiles, braking noise, effects, single toggle |
| `src/audio/music.ts`, `tracks.ts` | Procedural music scheduler and track data (menu loop plus seven race tracks) |
| `src/i18n/index.ts`, `types.ts`, `locales/*.ts` | `t()`, language detection, `LANGS`, fifteen locales |
| `src/ui/game-app.ts` | `GameApp`: owns save, race, renderer, audio and the menu/race/pause/over flow, autosave, sync triggers and platform plumbing |
| `src/ui/hud.ts`, `overlays.ts` | Top-bar HUD, pause/result screens |
| `src/ui/settings.ts`, `garage.ts` | Options dialog, garage (cars, paints, file export/import, coin-pack preview) |
| `src/ui/account.ts`, `auth-tabs.ts`, `username.ts` | First-launch/account screen, sign up / log in switch, username field cleaning |
| `src/ui/leaderboard.ts`, `tutorial.ts`, `about.ts` | Ranking dialog, how-to-play steps, About dialog |
| `src/ui/input.ts` | Keyboard, on-screen buttons, tilt and remote input merged per frame |
| `src/ui/remote-dialog.ts`, `controller-page.ts` | Pairing dialog (QR) on the main screen; page shown on the phone |
| `src/ui/car-art.ts`, `dom.ts`, `notifications.ts`, `icons.ts`, `flags.ts`, `units.ts` | Car previews, DOM/format helpers, toasts and feedback, SVG icons, SVG language flags, unit formatting |
| `src/net/account.ts` | Account client: session identity marker, requests to `/api/auth` and `/api/account`, device cleanup on logout |
| `src/net/progress-sync.ts` | Durable local outbox and device-snapshot uploads to `/api/progress?device=` |
| `src/net/remote.ts` | Pairing and controller commands; `room-api.ts` and `room-socket.ts` own HTTP and socket lifecycles |
| `src/server/player-api.ts` | Shared Node/Vercel authorization in front of `/api/auth`, `/api/account`, `/api/score`, `/api/progress`, `/api/leaderboard` |
| `src/server/auth.ts`, `passwords.ts`, `accounts.ts` | Signup/login/logout/password change, sessions and cookies, scrypt hashing, `AccountStore` interface |
| `src/server/account-progress.ts`, `score-cleanup.ts` | Account progress reconciliation; guest-row absorption and shadow-row retirement |
| `src/server/cloud.ts`, `players.ts`, `leaderboard.ts` | HTTP handlers for progress/score/leaderboard, score and backup business rules, pagination and public response mapping |
| `src/server/mongo-store.ts`, `mongo-player-store.ts`, `mongo-account-store.ts` | MongoDB connection and indexes, versioned player records, account/session/attempt records |
| `src/server/signaling.ts` | Shared room HTTP protocol; Redis in production, memory only for isolated tests/local development |
| `src/server/redis.ts`, `redis-rooms.ts`, `redis-sockets.ts` | Redis connection, atomic room operations, socket presence leases and Pub/Sub |
| `src/server/room-sockets.ts`, `socket-session.ts`, `socket-store.ts`, `dev-sockets.ts` | WebSocket upgrade validation, authenticated socket lifecycle, store interface, local-development socket store |
| `src/server/proxy.ts`, `node-config.ts` | Edge API proxy; production configuration validation and request-origin resolution |
| `src/shared/config.ts` | Public runtime config (`PISTA84_COINS`, `PISTA84_PROGRESS_TOOLS`) |
| `src/client.ts` | Entry point: fetch `/runtime-config.json`, then load the game or the controller page on demand |
| `api/*.ts` | Vercel entrypoints: `auth`, `account`, `progress`, `score`, `leaderboard`, `rooms`, `controller` (WebSocket upgrade), `health`; `_store.ts`/`_rooms.ts` are private helpers |
| `scripts/node-server.ts` | Shared Node static server and API router, public config, local network/QR, health and socket upgrades |
| `scripts/build.ts`, `env.ts` | Build (www, Worker, generated assets, chunk list) and `.env`/runtime-config loading |
| `scripts/check-online.ts`, `check-socket-storage.ts`, `verify-hosted.ts` | Live MongoDB/Redis diagnostics and hosted smoke check |
| `scripts/local.sh`, `check-local.ts` | Docker stack control (`up`, `down`, `reset`, `logs`, `status`, `env`, `check`, `test`) and its end-to-end smoke check; see [storage](../docs/STORAGE.md#local-docker-stack) |
| `scripts/screenshots.ts`, `reference-shot.ts`, `review-driving.ts`, `review-brazilian-cars.ts`, `native-assets.ts` | Review captures and native icon/splash generation |
| `dev-server.ts`, `production-server.ts` | Local and production launchers; production requires MongoDB/Redis and ignores local env files |
| `worker/index.ts` | Static edge assets, public config and proxy to Node APIs |
| `web/sw.ts` | Service worker (offline cache) |

`src/game`, `src/server` and `src/shared` have no DOM dependency and are exercised directly by the Node tests.

## Local progress

Storage key: **`pista84`**, JSON save format **2**. Other device-owned keys use the `pista84.` prefix (`pista84.device`, `pista84.progress-outbox`, `pista84.progress-ack:*`, `pista84.account`, `pista84.synced`).

```json
{
  "version": 2,
  "coins": 0,
  "best": 0,
  "bestScore": 0,
  "owned": ["fusca"],
  "selected": "fusca",
  "paints": ["original"],
  "paint": "original",
  "sound": true,
  "lang": null,
  "username": null,
  "playerId": "<GUID>",
  "history": [],
  "units": "km",
  "tutorialDone": false,
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000
}
```

| Field | Meaning and validation |
| --- | --- |
| `coins` | Wallet; finite values become non-negative integers |
| `best` / `bestScore` | Best distance in metres (non-negative) / best score in points (non-negative integer) |
| `owned`, `paints` | Catalog IDs only; duplicates removed; Fusca and `original` are always included |
| `selected`, `paint` | Must be owned, otherwise the default |
| `sound` | `true` unless explicitly `false` |
| `lang` | UI language code, or `null` to follow the browser |
| `username` | Pilot name, normalized by the username rules (3–16 characters of `a-z`, `0-9`, `_`, `-`); otherwise `null`. For a signed-in pilot it equals the account username |
| `playerId` | Permanent GUID; a new one is generated when missing or malformed. For a signed-in pilot it is the server-issued account GUID |
| `history` | Up to 20 retired players (`playerId`, `username`, `bestScore`, `best`, `retired`); invalid entries are dropped |
| `units` | `km` or `mi`; anything else is `km` |
| `tutorialDone` | `true` only when explicitly true |
| `createdAt` / `updatedAt` | Milliseconds; legacy saves without them count as created now; `updatedAt` defaults to `createdAt` and is stamped on every save |

Missing, malformed or null data uses defaults. Ownership is validated against the catalog but not against how a car was paid for. `importSave` replaces everything, but an export without an identity, name, history, units, tutorial flag or creation time keeps the current device's value, and importing the same GUID keeps the highest score and distance of the two.

No active entities, room tokens, running-state snapshot or paid entitlement belongs in this save. Storage failures show feedback and keep the session playable. Exports contain the progress JSON; import checks shape/size and normalizes through the same validator.

## Environment balance override and runtime config

The local server and build load `.env` through Node's `loadEnvFile` (`scripts/env.ts`). `PISTA84_COINS` accepts a nonnegative safe integer; empty disables the override; an invalid value throws. `PISTA84_PROGRESS_TOOLS` accepts `true` or `false` (case insensitive); unset/empty keeps the fallback, which defaults to true. It controls the visibility of the garage file export/import controls, without disabling automatic saving or sync. The only values exposed to the browser are the allowlisted object `{ "coins": number | null, "progressTools": boolean }`, served as JSON by **`GET /runtime-config.json`** (`Cache-Control: no-store`) from the Node server and from the Worker, and written to `www/runtime-config.json` at build time for static and native packaging. `src/client.ts` fetches it at startup and falls back to `{ coins: null, progressTools: true }` if it is unavailable. Other environment values are never exposed. The Worker embeds the build-time config through an esbuild `define` and lets a Worker runtime `PISTA84_COINS` and `PISTA84_PROGRESS_TOOLS` take precedence.

The override is applied when loading local, imported or restored progress, and when reading a cloud snapshot. Reads do not change database rows or revisions. Purchases and rewards still change the session balance; reloading reapplies the configured value. This setting applies to all players of the configured environment. Clearing it restores normal saved-balance behavior. `.env` is ignored by Git; `.env.example` documents the options (`PISTA84_COINS`, `PISTA84_PROGRESS_TOOLS`, `PORT`, `MONGODB_URI`, `MONGODB_DATABASE`, `REDIS_URL`, `API_ORIGIN`, `PUBLIC_ORIGIN`).

## Online data and cloud sync

Online features require a signed-in account. A guest (no session) never calls the online API: no health check, score, progress or leaderboard request. The server also rejects `/api/score` and `/api/progress` without a session (HTTP 401).

For signed-in devices, existing local saves are queued on launch and later local changes are coalesced in a persistent outbox. Autosaves remain local during play; automatic uploads occur only on first entry (launch), pause, game end, return to the menu or page exit/backgrounding, never on a timer or reconnect. Failed uploads stay queued across reloads and player switches until the next such event. Legacy saves receive a stable GUID before upload. Per-player/device snapshots live durably in MongoDB `device-backups` and are isolated from the account's merged progress and from the legacy `backups` collection (read by the server, no longer written by the game). See [storage documentation](../docs/STORAGE.md) for retry, conflict and recovery behavior. Local data can only migrate after that browser visits the updated game with connectivity.

The backend separates responsibilities into small modules (see the module table): `mongo-store.ts` owns connections/index setup; `mongo-player-store.ts` owns database operations; `players.ts` owns score/backup rules; `leaderboard.ts` owns shared pagination and public response mapping; `player-api.ts` applies account authorization for every Node/Vercel entrypoint. `redis.ts` owns its connection and `redis-rooms.ts` owns room operations. Memory player storage is a test double in `tests/support/`, not a production fallback.

MongoDB owns durable online scores, device snapshots, legacy manual backups, accounts and account progress. The Node/Vercel runtime uses `MONGODB_URI` and optional `MONGODB_DATABASE` (default `pista84`). Collections: `scores`, `backups`, `device-backups`, `account-progress`, `accounts`, `sessions`, `auth-attempts`. Player collections have one record per GUID (device snapshots: player GUID + device GUID). Score records mirror indexed score/achievement fields; backups contain sanitized saves and public revisions. Updates compare internal versions and retry conflicts; stale revisions return HTTP 409. The `x-player-id` header identifies a guest GUID (guests can only read the public leaderboard). Account GUIDs require a matching server-side session and cannot be authorized by that header alone. Local device progress and file export/import remain available offline.

Accounts use `accounts` (unique normalized username), `sessions` (hashed random token plus expiry) and `auth-attempts` (shared expiring budgets). Node hashes passwords with salted scrypt; the browser receives only a user DTO and a Secure/HttpOnly/SameSite cookie over HTTPS. The edge Worker forwards only game session cookies and preserves Set-Cookie without caching responses. `POST /api/auth` with `action: "password"` changes the password after re-checking the current one, revokes every session of the account and issues a fresh one for the calling device.

`PUT /api/account` reconciles guest/local data with the session's separate `account-progress` record on login or explicit sync. Maxima preserve records, unions preserve unlocks, guest coins use the larger balance and later account timestamps preserve spending/selections. CAS retries protect concurrent merges; device snapshots remain separate. When a guest GUID is merged, that guest's ranking row is absorbed into the account row only if it carries the account's own name. Leaderboard reads retire guest rows that duplicate a registered pilot (at most once a minute per instance). Failed merges retain local data. Logout revokes that device's session, cancels uploads and clears all local `pista84`/`pista84.*` records before creating a new guest save (only language, sound and units carry over); other tabs reload. Cloud records remain. Details, password/session parameters and limitations are in [storage documentation](../docs/STORAGE.md#optional-accounts-and-account-reconciliation).

The static game/PWA/Capacitor shell remains in place; no Next.js migration or SSR runtime is introduced. Browser gameplay needs the simulation and renderer offline. Private database queries, password work, sessions and response filtering already run only on the Node backend. Account response DTOs never expose password hashes. The small `game.js` entry dynamically imports either the game or the controller; esbuild emits shared chunks under `www/chunks/`. A controller does not download the game renderer. The build injects every emitted client chunk into the service worker's precache list so installed game launches still work offline.

Redis owns ephemeral pairing rooms (ten minutes) and latest controller input (two seconds, capped by the room lifetime), plus socket presence leases (fifteen seconds, renewed every five seconds). Redis Pub/Sub delivers commands between Node/Vercel instances without HTTP polling. Single-controller claims and expiry checks are atomic scripts. Deployed pairing has no instance-memory fallback. Node may use memory pairing only when Redis is absent in local development; it never acknowledges a volatile cloud save. Missing/unreachable services return 503 without erasing local progress.

See [storage documentation](../docs/STORAGE.md) for exact record/key layouts, connection handling, deployment, data transition and verification.

## Build and hosting

For a laptop with only Docker, `bash scripts/local.sh up` builds the `Dockerfile` image and starts `docker-compose.yml`: the game (`dev-server.ts`, HTTP) plus private MongoDB 7 and Redis 7 containers, configured from a generated `.env.docker`. It is a development convenience; Heroku, Vercel and the Worker do not use it.

`npm run build` generates `www/`, the Worker asset module (`worker/generated-assets.ts`) and `dist/server/index.js`. Browser entry is `src/client.ts`; local Node entry is `dev-server.ts`. Generated output is not source. `npm run dev` builds before starting the local server (`predev`). `npm start` runs `production-server.ts` against already-built assets. Heroku builds through `heroku-postbuild` and runs the production launcher through the `Procfile`. HTTPS proxy requests use `PUBLIC_ORIGIN` or Heroku's forwarded scheme; production never falls back to in-memory pairing.

Vercel serves static files and Node API functions (`vercel.json` rewrites `/health` and `/api/rooms/*`). The optional browser-targeted Worker serves assets/config and proxies online APIs to an HTTPS `API_ORIGIN` pointing at the Node deployment. Database credentials stay on Node; the Worker has no database binding and never bundles TCP drivers. Do not name any root, `src/` or browser bundle file `app`, `index`, `server` or `main`: Vercel may auto-detect it as a backend (guarded by `tests/vercel-config.test.ts`).

## Offline and native

Service worker cache **pista84-v25** stores the listed same-origin app assets (`/`, HTML, CSS, manifest, icons, vehicle atlases, `game.js`, generated client chunks and `runtime-config.json`). It uses network-first reads with cache fallback, removes older game caches, and excludes `/api/` traffic. No cloud snapshot, account response, pairing token or API response is cached. Remote control and cloud sync require connectivity. Cross-origin Google Fonts are not cached, so offline play uses the system font fallbacks. The service worker is not registered inside the native wrapper or by the controller page.

Capacitor uses `www/`, app ID `br.com.pista84.app`, name PISTA 84. Android/iOS projects, icons and splash assets exist; iOS includes the motion-use description. `npm run native:sync` builds/copies web assets. Build tools, signing and physical-device verification are separate release requirements. Native-wrapper remote control is currently directed to the web version, and native builds need a separately verified same-origin HTTPS API/cookie setup for accounts.
