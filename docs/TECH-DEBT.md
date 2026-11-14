# PISTA 84 tech debt

Online data lives in MongoDB (scores, accounts, sessions, account progress and device snapshots) and expiring Redis keys
(pairing rooms, socket presence, controller input, Pub/Sub).
See [STORAGE.md](STORAGE.md) for architecture, configuration and consistency, and
[specs/09-roadmap.md](../specs/09-roadmap.md) for planned work.

## Remaining limitations

- The local Docker stack ([STORAGE.md](STORAGE.md#local-docker-stack)) serves plain HTTP: tilt sensors and Secure cookies cannot be exercised there, and its `/network` endpoint reports the container address, so phone pairing needs the computer's LAN address typed by hand.

- **Client-reported scores.** Scores, distances and coins come from the browser. Accounts require sessions, but there is no
  verified run scoring, anti-cheat or server-side wallet; edited saves and device clock skew are possible. Timestamp-based
  reconciliation is not a currency ledger (ECO-01 before any real-money balance).
- **Score and snapshot writes are separate operations.** A snapshot can commit while score publication fails (or the reverse), so
  callers may need to read the snapshot before retrying and use its current revision.
- **Accounts are minimal.** Password recovery, email verification, MFA, account renaming, account deletion and remote logout of
  all devices (other than the one triggered by a password change) are not implemented.
- **Legacy data.** Guest GUID rows and the `backups` collection remain for compatibility but are no longer written by the
  game; a cross-device snapshot picker is not implemented. Retired guest rows are only cleaned when a ranking read finds them.
- **Native builds** need a separately verified same-origin HTTPS API and cookie setup; packaged static assets alone give no
  account backend. Native-wrapper remote control is directed to the web version.
- **Sockets on Vercel** are bound by function duration limits. Clients reconnect with bounded backoff and Redis coordinates
  instances, but the WebSocket upgrade can only be verified after a real deployment. Rooms still expire ten minutes after
  creation, even when active (NET-02).
- **Old provider data** is not imported or deleted. Retain or import needed records before switching traffic.
- **Vercel backend auto-detection** treats root, `src/` or browser bundles named `app`, `index`, `server` or `main` as server
  entrypoints. Preserve `client.ts`, `game.js` and `dev-server.ts` naming and the tests guarding them (`tests/vercel-config.test.ts`).

## Module-size debt

The quality workflow targets handwritten implementation modules below 300 physical lines (299 maximum). A 2026-11-14 scan of `src/`, `api/`, `worker/` and `scripts/` found seven TypeScript files at or above 300 lines, excluding generated Worker assets:

- `src/ui/game-app.ts`: application orchestration and race/account lifecycle.
- `src/render/renderer.ts`: scene and road rendering.
- `src/render/sprites.ts`: atlas loading, recoloring, fallback sprites and drawing.
- `src/render/procedural-cars.ts`: procedural vehicle painters.
- `src/game/race.ts`: simulation and run lifecycle.
- `src/render/scenery.ts`: scenery artwork and caches.
- `src/ui/input.ts`: input sources, permissions and bindings.

These are existing overages, not new compliance claims. QLT-01 tracks decomposition along responsibility boundaries. Extract touched responsibilities when feasible, preserve public behavior and dependency direction, and validate with simulation/browser tests. Do not minify, remove useful comments or create arbitrary numbered chunks merely to meet the limit. Report oversized data-only and test files separately during quality review.
