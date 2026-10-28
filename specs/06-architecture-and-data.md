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
    server/              room signaling, cloud backup, D1 types
    shared/              public runtime config
    client.ts, qr.ts     browser entry point, QR generation
  web/                   HTML, CSS, PWA files, sw.ts and artwork
  worker/                hosted Worker entrypoint
  db/                    Drizzle schema
  drizzle/               immutable SQL migrations and metadata
  tests/                 Node tests, test support, Playwright specs
  scripts/               build, env, assets, screenshots and verification (TypeScript)
  dev-server.ts          local Node server
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
| `src/net/remote.ts` | Pairing client, WebRTC and HTTP compatibility transport |
| `src/server/signaling.ts` | Shared room API with D1 and in-memory stores |
| `src/server/cloud.ts`, `d1.ts` | Authenticated per-user backup with revision checks; structural D1 types |
| `src/shared/config.ts` | Public runtime config (`PISTA84_COINS`) |
| `src/client.ts` | Entry point: fetch `/runtime-config.json`, then mount the game or the controller page |
| `dev-server.ts` | Local Node static server, in-memory pairing, `/runtime-config.json`, `/network`, `/qr`, `/health`, legacy WebSocket relay |
| `worker/index.ts` | Hosted static assets, `/runtime-config.json`, health, pairing and backup endpoints |
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

The local server and build load `.env` through Node's `loadEnvFile` (`scripts/env.ts`). `PISTA84_COINS` accepts a nonnegative safe integer; empty disables the override; an invalid value throws. The only value exposed to the browser is the allowlisted object `{ "coins": number | null }`, served as JSON by **`GET /runtime-config.json`** (`Cache-Control: no-store`) from the Node server and from the Worker, and written to `www/runtime-config.json` at build time for static and native packaging. `src/client.ts` fetches it at startup and falls back to `{ coins: null }` if it is unavailable. Other environment values are never exposed. The Worker embeds the build-time config through an esbuild `define` and lets a Worker runtime `PISTA84_COINS` take precedence.

The override is applied when loading local, imported or restored progress, and when reading a cloud backup. Reads do not change database rows or revisions. Purchases and rewards still change the session balance; reloading reapplies the configured value. This setting applies to all players of the configured environment. Clearing it restores normal saved-balance behavior. `.env` is ignored by Git; `.env.example` documents the options (`PISTA84_COINS`, `PORT`, optional `PUBLIC_ORIGIN`).

## Cloud backup

Hosted only, manually invoked from the garage. Identity is supplied by the Sites gateway in `oai-authenticated-user-id`; user identity is not accepted from request JSON. Read returns the account snapshot/revision, or an empty snapshot at revision 0. Writes require the current revision and fail with 409 on conflict.

Restore replaces local progress and resets the active run. Backup does not turn client-reported coins into a trusted financial balance. The local Node server does not emulate an authenticated cloud account (it has no `/api/progress`), and `/health` there lacks `cloudBackup`, so the backup buttons stay hidden.

## Database

Binding: **`DB`**, provisioned for the hosted Worker. Schema: [db/schema.ts](../db/schema.ts).

| Table | Fields | Purpose |
| --- | --- | --- |
| `control_rooms` | `id` PK; `host_token`, `join_token`, `offer`, nullable `answer`, `expires`, nullable `input`, `input_time` default 0 | Pairing and latest compatibility command |
| `player_progress` | `user_id` PK; `data`, `revision`, `updated` | Per-account manual casual backup |

Room data does not contain a command history. Tokens/room IDs are random 24-byte values encoded as 48 hex characters. Database access uses parameterized statements. The local pairing store is ephemeral memory with a 500-room cap.

Migrations are append-only: `0000_furry_marvex.sql` creates rooms, `0001_true_shriek.sql` adds progress, and `0002_steep_roulette.sql` adds compatibility-input fields. Change schema, generate a new migration (`npm run db:generate`), inspect it, and preserve previously applied SQL/metadata.

## Build and hosting

`npm run build` (`scripts/build.ts`) empties `www/`, copies `web/` into it (skipping `.ts` sources), bundles `src/app.ts` and `web/sw.ts` with esbuild, writes `www/runtime-config.json`, embeds every file of `www/` as a generated module (`worker/generated-assets.ts`, ignored by Git) and bundles the Worker ESM at `dist/server/index.js`. PNG bytes are preserved as binary responses. Generated output is not the editing source. `npm start` / `npm run dev` run `node server.ts`, which serves `www/`, so build first.

The tracked `.openai/hosting.json` retains the Site project identity and D1 binding. Hosted updates must publish the exact pushed source/artifact and preserve the existing private audience. Documentation-only changes do not require a game deployment.

## Offline and native

Service worker cache **pista84-v21** stores the listed same-origin app assets (`/`, HTML, CSS, manifest, icons, both atlases, `game.js`, `runtime-config.json`). It uses network-first reads with cache fallback, removes older game caches, and excludes `/api/` and relay traffic. No cloud backup, pairing token or API response is cached. Remote control and cloud backup require connectivity. Cross-origin Google Fonts are not cached, so offline play uses the system font fallbacks. The service worker is not registered inside the native wrapper.

Capacitor uses `www/`, app ID `br.com.pista84.app`, name PISTA 84. Android/iOS projects, icons and splash assets exist; iOS includes the motion-use description. `npm run native:sync` builds/copies web assets. Build tools, signing and physical-device verification are separate release requirements. Native-wrapper remote control is currently directed to the web version.
