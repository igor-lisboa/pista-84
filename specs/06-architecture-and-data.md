# 06 — Architecture, persistence and packaging

[Specification index](README.md)

## Workspace layout

```text
car-game/
  README.md
  specs/                 canonical game definitions
  src/                   browser modules and shared service logic
  web/                   HTML, CSS, PWA files and artwork
  worker/                hosted Worker entrypoint
  db/                    Drizzle schema
  drizzle/               immutable SQL migrations and metadata
  tests/                 unit/service and browser tests
  scripts/               build, assets, screenshots and verification
  android/ and ios/      generated Capacitor projects
  www/                   generated browser/native assets (ignored)
  dist/                  generated hosted Worker (ignored)
  docs/                  historical entry points and art provenance/screenshots
```

This documentation change introduces no new runtime behavior. The canonical `specs/` lives at the repository root, next to the application source.

## Module responsibilities

| Module | Responsibility |
| --- | --- |
| `src/engine.js` | DOM-independent simulation, catalog, environment and save validation |
| `src/app.js` | Menu/race lifecycle, inputs, UI, checkpoints and controller screen |
| `src/garage.js` | Vehicle/paint purchases, file import/export, manual cloud backup |
| `src/render.js` | Responsive perspective, road, scene projection and environment effects |
| `src/scenery.js` | Cached city, clouds and trees |
| `src/sprites.js` | Atlas loading/trimming, paints, vehicle rendering and fallback art |
| `src/audio.js` | Synthesized engines, braking, soundtrack and effects |
| `src/remote.js` | Pairing client, WebRTC and HTTP compatibility transport |
| `src/signaling.js` | Shared room API with D1/memory stores |
| `src/cloud.js` | Authenticated per-user backup with revision checks |
| `server.mjs` | Local Node static server, in-memory pairing, legacy WebSocket relay |
| `worker/index.js` | Hosted static assets, health, pairing and backup endpoints |

## Local progress

Storage key: **`pista84`**, JSON save format **2**.

```json
{
  "version": 2,
  "coins": 0,
  "best": 0,
  "owned": ["fusca"],
  "selected": "fusca",
  "paints": ["original"],
  "paint": "original",
  "sound": false
}
```

`best` is meters. Validation clamps finite coin values to nonnegative integers, rejects invalid catalog IDs, removes duplicate ownership, always includes Fusca/original paint and only accepts owned selections. Missing, malformed or null data uses defaults. Version-1-era progress receives defaults for new fields.

No active entities, room tokens, running-state snapshot or paid entitlement belongs in this save. Storage failures show feedback and keep the session playable. Exports contain the progress JSON; import checks shape/size and normalizes through the same validator.

## Cloud backup

Hosted only, manually invoked from the garage. Identity is supplied by the Sites gateway in `oai-authenticated-user-id`; user identity is not accepted from request JSON. Read returns the account snapshot/revision, or an empty snapshot at revision 0. Writes require the current revision and fail with 409 on conflict.

Restore replaces local progress and resets the active run. Backup does not turn client-reported coins into a trusted financial balance. The local Node server does not emulate an authenticated cloud account.

## Database

Binding: **`DB`**, provisioned for the hosted Worker. Schema: [db/schema.ts](../db/schema.ts).

| Table | Fields | Purpose |
| --- | --- | --- |
| `control_rooms` | `id` PK; `host_token`, `join_token`, `offer`, nullable `answer`, `expires`, nullable `input`, `input_time` default 0 | Pairing and latest compatibility command |
| `player_progress` | `user_id` PK; `data`, `revision`, `updated` | Per-account manual casual backup |

Room data does not contain a command history. Tokens/room IDs are random 24-byte values encoded as 48 hex characters. Database access uses parameterized statements. The local pairing store is ephemeral memory with a 500-room cap.

Migrations are append-only: `0000_furry_marvex.sql` creates rooms, `0001_true_shriek.sql` adds progress, and `0002_steep_roulette.sql` adds compatibility-input fields. Change schema, generate a new migration, inspect it, and preserve previously applied SQL/metadata.

## Build and hosting

`npm run build` copies `web/` and modules into `www/`, bundles browser QR support and embeds web assets in a Worker ESM bundle at `dist/server/index.js`. PNG bytes are preserved as binary responses. Generated output is not the editing source.

The tracked `.openai/hosting.json` retains the Site project identity and D1 binding. Hosted updates must publish the exact pushed source/artifact and preserve the existing private audience. Documentation-only changes do not require a game deployment.

## Offline and native

Service worker cache **pista84-v5** stores listed same-origin app assets, including atlas/scenery. It uses network-first reads with cache fallback, removes older game caches, and excludes `/api/` and relay traffic. No cloud backup, pairing token or API response is cached. Remote control and cloud backup require connectivity.

Capacitor uses `www/`, app ID `br.com.pista84.app`, name PISTA 84. Android/iOS projects, icons and splash assets exist; iOS includes the motion-use description. `npm run native:sync` builds/copies web assets. Build tools, signing and physical-device verification are separate release requirements. Native-wrapper remote control is currently directed to the web version.
