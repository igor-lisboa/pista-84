# 06 — Architecture, persistence and packaging

[Specification index](README.md)

## Workspace layout

```text
car-game/
  README.md
  specs/                 canonical game definitions
  src/
    game/                pure simulation, no DOM
    render/              Canvas renderer, scenery, sprites
    audio/               Web Audio engine, procedural music
    i18n/                translator and locales
    ui/                  screens, HUD, input, dialogs
    net/                 phone-controller client
    server/              room signaling, cloud backup, MongoDB/Redis adapters
    shared/              public runtime config
    client.ts, qr.ts     browser entry point, QR generation
  web/                   HTML, CSS, PWA files, sw.ts and artwork
  worker/                hosted Worker entrypoint
  db/                    historical SQL schema (inactive)
  drizzle/               immutable SQL migrations and metadata
  tests/                 Node tests, test support, Playwright specs
  scripts/               build, env, assets, screenshots and verification (TypeScript)
  dev-server.ts          local Node launcher
  production-server.ts   production Node launcher
  tsconfig.json, drizzle.config.ts, playwright.config.ts
  android/ and ios/      generated Capacitor projects
  www/                   generated browser/native assets (ignored)
  dist/                  generated hosted Worker (ignored)
  docs/                  historical entry points and art provenance/screenshots
```

The canonical `specs/` lives at the repository root, next to the application source.

## TypeScript toolchain

All source is TypeScript; no JavaScript or `.mjs` remains. Node.js **24** runs `.ts` files directly through type stripping, so only **erasable syntax** is allowed (`erasableSyntaxOnly`: no enums, namespaces or parameter properties) and relative imports carry a `.ts` extension (`allowImportingTsExtensions`). `tsc --noEmit -p .` (`npm run typecheck`, strict mode) is the typechecker for `src`, `tests`, `scripts`, `worker`, `web/sw.ts`, `db`, `server.ts` and the config files. **esbuild** bundles the browser app (`src/client.ts` → `www/game.js`, ESM) and the service worker (`web/sw.ts` → `www/sw.js`, IIFE), both targeting **es2019**, and the Worker (`worker/index.ts` → `dist/server/index.js`). Code, comments, identifiers, test names and server/API error messages are English; player-facing text lives in `src/i18n/locales/*.ts`.

## Module responsibilities

| Module | Responsibility |
| --- | --- |
| `src/game/cars.ts` | 14-vehicle catalog (`CarSpec`, `Purchase`), paints, defaults |
| `src/game/race.ts` | `Race`: states, driving, off-road, crashes, score, coins, checkpoints, fuel, second chance, spawning |
| `src/game/traffic.ts` | Traffic and fuel entities: ramp, waves, lane changes, following, separation |
| `src/game/road.ts` | Seeded stateless road curve plus lane/camera geometry constants |
| `src/game/scoring.ts` | `paceMultiplier` |
| `src/game/environment.ts` | Light and weather as a function of run time |
| `src/game/save.ts` | `SaveData` (v2), `loadSave` sanitising, `PISTA84_COINS` override |
| `src/game/index.ts`, `math.ts` | Public barrel, `clamp` |
| `src/render/renderer.ts` | Responsive perspective, road, scene projection, environment effects, shake and overlays |
| `src/render/scenery.ts`, `billboards.ts`, `noise.ts` | Cached city, clouds, trees, lamps, billboards and their ad texts, deterministic hash |
| `src/render/sprites.ts` | Atlas loading/trimming, paints, turn frames, procedural sprites |
| `src/audio/audio.ts` | `AudioEngine`: 14 engine profiles, braking noise, effects, single toggle |
| `src/audio/music.ts`, `tracks.ts` | Procedural music scheduler and track data |
| `src/i18n/index.ts`, `types.ts`, `locales/*.ts` | `t()`, language detection, `LANGS`, fifteen locales |
| `src/ui/game-app.ts` | `GameApp`: owns save, race, renderer, audio and the menu/race/pause/over flow, autosave and platform plumbing |
| `src/ui/hud.ts`, `overlays.ts`, `settings.ts`, `garage.ts` | Top-bar HUD, pause/result screens, options dialog, garage and backup |
| `src/ui/input.ts` | Keyboard, on-screen buttons, tilt and remote input merged per frame |
| `src/ui/remote-dialog.ts`, `controller-page.ts` | Pairing dialog (QR) on the main screen; page shown on the phone |
| `src/ui/car-art.ts`, `dom.ts`, `notifications.ts` | Car previews, DOM/format helpers, toasts and feedback |
| `src/net/remote.ts` | Pairing and controller commands; `room-api.ts` and `room-socket.ts` own HTTP and socket lifecycles |
| `src/server/signaling.ts` | Shared room protocol; Redis in production, memory only for isolated tests/local fallback |
| `src/server/cloud.ts`, `d1.ts` | Authenticated per-user backup with revision checks; structural MongoDB/Redis adapters |
| `src/shared/config.ts` | Public runtime config (`PISTA84_COINS`, `PISTA84_PROGRESS_TOOLS`) |
| `src/client.ts` | Entry point: fetch `/runtime-config.json`, then mount the game or the controller page |
| `scripts/node-server.ts` | Shared Node static server, MongoDB/Redis APIs, public config, local network/QR, health and socket relay |
| `dev-server.ts`, `production-server.ts` | Local and production launchers; production requires MongoDB/Redis and ignores local env files |
| `worker/index.ts` | Static edge assets, public config and proxy to Node APIs |
| `web/sw.ts` | Service worker (offline cache) |

`src/game`, `src/server` and `src/shared` have no DOM dependency and are exercised directly by the Node tests.

## Local progress

Storage key: **`pista84`**, JSON save format **2**.

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
  "lang": null
}
```

`best` is the best distance in metres and `bestScore` the best score in points. `lang` is the chosen UI language code or `null` to follow the browser. `sound` defaults to **true**. Validation clamps finite coin values to nonnegative integers, rejects invalid catalog IDs, removes duplicate ownership, always includes Fusca/original paint and only accepts owned selections. Missing, malformed or null data uses defaults. Older progress receives defaults for new fields (`bestScore` 0, `lang` null, `sound` true unless explicitly `false`). Ownership is validated against the catalog but not against how a car was paid for.

No active entities, room tokens, running-state snapshot or paid entitlement belongs in this save. Storage failures show feedback and keep the session playable. Exports contain the progress JSON; import checks shape/size and normalizes through the same validator.

## Environment balance override and runtime config

The local server and build load `.env` through Node's `loadEnvFile` (`scripts/env.ts`). `PISTA84_COINS` accepts a nonnegative safe integer; empty disables the override; an invalid value throws. `PISTA84_PROGRESS_TOOLS` accepts `true` or `false` (case insensitive); unset/empty keeps the fallback, which defaults to true. It controls garage export/import and manual cloud save/restore visibility, without disabling automatic saving or sync. The only values exposed to the browser are the allowlisted object `{ "coins": number | null, "progressTools": boolean }`, served as JSON by **`GET /runtime-config.json`** (`Cache-Control: no-store`) from the Node server and from the Worker, and written to `www/runtime-config.json` at build time for static and native packaging. `src/client.ts` fetches it at startup and falls back to `{ coins: null, progressTools: true }` if it is unavailable. Other environment values are never exposed. The Worker embeds the build-time config through an esbuild `define` and lets a Worker runtime `PISTA84_COINS` and `PISTA84_PROGRESS_TOOLS` take precedence.

The override is applied when loading local, imported or restored progress, and when reading a cloud backup. Reads do not change database rows or revisions. Purchases and rewards still change the session balance; reloading reapplies the configured value. This setting applies to all players of the configured environment. Clearing it restores normal saved-balance behavior. `.env` is ignored by Git; `.env.example` documents the options (`PISTA84_COINS`, `PISTA84_PROGRESS_TOOLS`, `PORT`, optional `PUBLIC_ORIGIN`).

## Online data and cloud backup

Existing local saves are queued on launch without requiring a score, username
or manual backup action. Later local changes are coalesced in a persistent outbox.
Autosaves remain local during play; automatic uploads occur only on pause, game
end, return to the menu or page exit/backgrounding, never on a timer or reconnect.
Failed uploads remain queued across reloads for the next such event. Legacy saves
receive a stable GUID before upload. Per-player/device snapshots live durably in
MongoDB `device-backups`; they preserve each device's local progress separately
from manual backups. Failed uploads stay queued, including across page reloads
and player switches. See [storage synchronization](../docs/STORAGE.md) for retry,
conflict and recovery behavior. Local data can only migrate after that browser
visits the updated game with connectivity.

The backend separates responsibilities into small modules: `mongo-store.ts` owns
connections/index setup; `mongo-player-store.ts` owns database operations;
`players.ts` owns score/backup rules; `leaderboard.ts` owns shared pagination and
public response mapping. `redis.ts` owns its connection and `redis-rooms.ts` owns
room operations. Memory player storage is a test double in `tests/support/`,
not a production fallback.

MongoDB owns durable online scores and manual progress backups. The Node/Vercel
runtime uses MONGODB_URI and optional MONGODB_DATABASE (default pista84).
Each collection has one record per player GUID. Score records mirror indexed
score/achievement fields; backups contain sanitized saves and public revisions.
Updates compare internal versions and retry conflicts; stale backup revisions
return HTTP 409. Guest GUID identity uses x-player-id. Account GUIDs require a
matching server-side session and cannot be authorized by that header alone.
Local device progress and export/import remain available offline.

Optional username/password accounts use `accounts` (unique normalized username),
`sessions` (hashed random token plus expiry) and `auth-attempts` (shared expiring
budgets). Node hashes passwords with salted scrypt; the browser receives only a
user DTO and a Secure/HttpOnly/SameSite cookie over HTTPS. `player-api.ts` applies
the same authorization to Node and Vercel entrypoints. The edge Worker forwards
only game session cookies and preserves Set-Cookie without caching responses.

`PUT /api/account` reconciles guest/local data with the session's separate
`account-progress` record on login or explicit sync. Maxima preserve records,
unions preserve unlocks, guest coins use the larger balance and later account
timestamps preserve spending/selections. CAS retries protect concurrent merges;
manual backups/device snapshots remain separate. Failed merges retain local data.
Logout revokes that device's session, cancels uploads and clears all local player
records before creating a new guest; other tabs reload. Cloud records remain.
Details, password/session parameters and limitations are in
[storage documentation](../docs/STORAGE.md#optional-accounts-and-account-reconciliation).

The static game/PWA/Capacitor shell remains in place; no Next.js migration or SSR
runtime is introduced. Browser gameplay needs the simulation and renderer offline.
Private database queries, password work, sessions and response filtering already
run only on the Node backend. Account response DTOs never expose password hashes.
The small `game.js` entry dynamically imports either the game or the controller;
esbuild emits shared chunks under `www/chunks/`. A controller does not download
the game renderer. The build injects every emitted client chunk into the service
worker's precache list so installed game launches still work offline.

Redis owns ephemeral pairing rooms (ten minutes) and latest controller input
(two seconds, capped by the room lifetime), plus socket presence leases (fifteen
seconds, renewed every five seconds). Redis Pub/Sub delivers commands between
Node/Vercel instances without HTTP polling. Single-controller claims and expiry
checks are atomic scripts. Deployed pairing has no instance-memory fallback.
Node may use memory pairing only when Redis is absent for local development;
it never acknowledges a volatile cloud backup. Missing/unreachable services
return 503 without erasing local progress.

See [storage documentation](../docs/STORAGE.md) for exact record/key layouts,
connection handling, deployment, data transition and verification. Historical
SQL schema/migrations are retained as reference and are not used at runtime.

## Build and hosting

npm run build generates www/, the Worker asset module and
dist/server/index.js. Browser entry is src/client.ts; local Node
entry is dev-server.ts. Generated output is not source. npm run dev
builds before starting the local server. npm start runs production-server.ts
against already-built assets. Heroku builds through heroku-postbuild and runs
the production launcher through the Procfile. HTTPS proxy requests use
PUBLIC_ORIGIN or Heroku's forwarded scheme; production never falls back to
in-memory pairing.

Vercel serves static files and Node API functions. The optional browser-targeted
Worker serves assets/config and proxies online APIs to an HTTPS API_ORIGIN
pointing at the Node deployment. Database credentials stay on Node; the Worker
has no D1 binding and never bundles TCP drivers. Preserve the Site project ID
and audience; publishing is separate from local changes.

## Offline and native

Service worker cache **pista84-v25** stores the listed same-origin app assets (`/`, HTML, CSS, manifest, icons, vehicle atlases, `game.js`, generated client chunks and `runtime-config.json`). It uses network-first reads with cache fallback, removes older game caches, and excludes `/api/` and relay traffic. No cloud backup, pairing token or API response is cached. Remote control and cloud backup require connectivity. Cross-origin Google Fonts are not cached, so offline play uses the system font fallbacks. The service worker is not registered inside the native wrapper or by the controller page.

Capacitor uses `www/`, app ID `br.com.pista84.app`, name PISTA 84. Android/iOS projects, icons and splash assets exist; iOS includes the motion-use description. `npm run native:sync` builds/copies web assets. Build tools, signing and physical-device verification are separate release requirements. Native-wrapper remote control is currently directed to the web version.
