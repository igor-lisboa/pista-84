# 08 — Validation, operation and release

[Specification index](README.md)

## Local execution

Node.js **24** is the verified environment: it runs the TypeScript sources natively.

```powershell
npm install
npm run build
npm run dev
```

`npm run dev` builds and runs `node dev-server.ts` to serve the generated `www/`. Open `http://localhost:4173`. `PORT` changes the port. For LAN testing, connect both devices to the same reachable server; allow its port on the private network. Tilt requires a secure context, so use the HTTPS publication or a suitable HTTPS proxy. Configure `PUBLIC_ORIGIN` to the external origin when proxying the Node server.

Production uses `npm run build` followed by `npm start` (`node production-server.ts`).
Heroku builds through `heroku-postbuild` and starts through the `Procfile`, with no
runtime rebuild. Configure MongoDB, Redis and the external HTTPS `PUBLIC_ORIGIN`;
Heroku supplies `PORT`. See [Heroku configuration](../docs/STORAGE.md#heroku).

## Automated checks

```powershell
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:browser
```

- `npm run typecheck` is `tsc --noEmit -p .` (strict, erasable syntax only, `.ts` import extensions) over sources, tests, scripts, worker and config files. It is clean on 1.4.0.
- `npm test` runs isolated Node tests, including MongoDB adapter concurrency, backup revisions, ranking, room protocol and edge API proxy coverage. No normal test loads live storage credentials.
- `npm run test:browser` runs the Playwright specs in `tests/browser/` in Chromium and WebKit (the app server is started by `npm run dev`, with live databases disabled and no existing server reused). `tests/browser/support/harness.ts` bundles `harness-entry.ts` with esbuild and injects it as `window.Pista` so cases can call the game, renderer and sprite modules from `page.evaluate`.

Run `npm run build`, `npm run typecheck` and `npm test` for current evidence; test counts change as coverage grows. Run `npm run online:check` when validating configured MongoDB/Redis, using removable probe records.

| Coverage | Required evidence (test file) |
| --- | --- |
| Simulation | Acceleration, brake/throttle/coast, fuel, distance, braking stop, pickup cap/consumption, 350 km/h Veloce GT, 120 km/h = 2 km per minute (`race.test.ts`) |
| Crashes and off-road | Any traffic contact is fatal, barrier crash except after the second chance, grass drag to about 40 km/h, 10% traction, single `offroad` event, braking on the shoulder (`race.test.ts`) |
| Score and economy | Pace multiplier bounds, per-km reset, coins from score (`race.test.ts`, `world.test.ts`) |
| State | Pause freezes progress; continuation is unique; restart/reset restores state (`race.test.ts`, `world.test.ts`) |
| Traffic | All five lanes, distinct-lane waves, ramp and caps, gradual speed changes, lane changes without overlap, 16-car cap (`traffic.test.ts`) |
| Vehicles and audio | 18 distinct cars, all purchased with coins, one engine voice per car, motorcycle rain grip, menu and race music tracks (`world.test.ts`, `race.test.ts`) |
| Environment | Road bounds/direction changes by seed; continuous light/weather intensities (`world.test.ts`) |
| Progress | Malformed saves, ownership validation, migration, sound default and language, balance override, per-user backup and revision conflict (`world.test.ts`, `cloud.test.ts`, `config.test.ts`) |
| Automatic backups | No score/progress uploads through 35 seconds of active racing or reconnect; local autosaves continue; pause/end/exit upload; failed outbox survives reload and retries at the next boundary; resumed play defers pending PUT; device/manual isolation and stale writes (`progress-sync.test.ts`, `progress-sync.spec.ts`) |
| Languages | Fifteen languages offered; full locales cover every key with the same placeholders; no unknown keys; browser language mapping (`i18n.test.ts`) |
| Room services | Memory room protocol and live Redis diagnostics, token/role checks, atomic answer, expiration/deletion, compatibility input, cross-origin/oversized/invalid JSON rejection (`signaling.test.ts`) |
| Browser flows | Initial menu hides in race; pause/result/menu; barrier crash screen; off-road drag; language switch; vehicle and paint purchase persistence with unaffordable cars refused; fuel exhaustion gives one continuation (`game.spec.ts`) |
| Touch | Tap to start; pedals bottom-right and arrows bottom-left with the HUD clear of both corners; landscape pedals in view; no scroll (`mobile.spec.ts`) |
| Graphics | All 14 vehicles draw complete, unclipped sprites; eight straight sprites and sixteen turn frames are complete and distinct; five lanes with four dividers; balance override (`game.spec.ts`) |
| Offline | Reload into a playable game with cached modules/artwork; sound toggle degrades gracefully (`game.spec.ts`) |
| Remote | Socket start/brake without RTCPeerConnection; exactly three pairing HTTP calls and no polling; automatic socket reconnect, safe pause and new QR (`game.spec.ts`, `room-sockets.test.ts`) |

Chromium and WebKit projects run against the same local app. WebKit automation is evidence for that engine, **not a physical iPhone Safari certification**. The Windows WebKit test build lacks Web Audio; its graceful failure is checked without claiming audible output there.

## Hosted verification

### WebSocket controller transport (2026-11-08)

- Production build, TypeScript checking and all 115 Node tests passed.
- Four affected Chromium/WebKit controller cases passed. The request-count cases
  were rerun with a forced socket close: both reconnected, resumed on user input,
  and still made only the original three room HTTP calls.
- Real `.env` MongoDB/Redis checks passed, including two independent Redis socket
  adapters exchanging Pub/Sub events, exclusive presence, bounded TTLs, replaced
  connection rejection, reconnect ownership and probe cleanup.
- Documentation and maintenance guidance describe the socket API and Redis leases.

No deployment or commit was made. After deploying, reload both game/controller
pages and verify a WebSocket upgrade on `/api/controller`. The four browser cases
are targeted coverage, not the full browser suite or physical iPhone certification.

### Automatic local-save synchronization (2026-11-08)

The launch/reconnect/periodic upload behavior verified below is historical.
The current contract uploads only at pause/end/exit boundaries, with local-only
racing autosaves; see the automatic-backup regression coverage above.

- Production build, TypeScript checking and all 111 Node tests passed on Node 24.
- The 36 affected Chromium/WebKit cases in `game.spec.ts`, `new-player.spec.ts`
  (since removed with the New Player action) and `progress-sync.spec.ts` were exercised. A WebKit offline failure was fixed
  by retaining the outbox without fetching when the browser reports offline;
  all four offline-cache/migration cases passed in the final targeted rerun.
- Legacy saves without GUIDs preserved their garage, coins and stable generated
  identity through reconnect/reload, including the fallback UUID generator.
- Real `.env` MongoDB/Redis diagnostics passed: manual/device snapshot round trips
  and isolation, revision conflicts, controller claims, expiry and deletion.
  Unique probe records were cleaned up.

Existing players migrate when their browser visits the updated game with
connectivity. Automatic snapshots do not replace manual backups or restore over
local progress. This validation does not cover a deployed release, the full
Playwright suite or physical devices. No commit or deployment was made.

### MongoDB/Redis migration review (2026-11-07)

After the maintenance refactor, validation passed on Node 24:

- Production build and TypeScript checking.
- All 105 Node tests, including concurrent writes, backup revision conflicts and storage failure behavior.
- All 36 cases in `game.spec.ts` and `leaderboard.spec.ts`, across Chromium and WebKit.
- `npm run online:check` against the real configured MongoDB/Redis connections: score and backup round trips, exclusive controller claims, TTLs, expired input and deletion. Probe records were cleaned up.
- Repository diff whitespace checks. The six skill entrypoints were also validated during migration setup.

This evidence covers the storage change and affected browser flows, not the entire
Playwright suite, a deployed release or native-device testing. No commit or
deployment was made; existing remote records were not imported.

The hosted verification helper (`node scripts/verify-hosted.ts`, configuration `{ url, token }` as one JSON line on stdin) checks health, shared room creation/read/answer/delete, then pairs desktop Chromium with mobile WebKit, starts/brakes remotely and enters solo touch play. Its service credential is provided through hidden stdin and only attached to the intended Site origin. Never copy that credential into documentation, shell arguments or committed files.

The 1.3 published visual baseline received this hosted smoke check; no hosted run is recorded for 1.4. It does not verify signed native builds, actual iPhone sensors, paid transactions or ad delivery.

## Visual review artifacts

| Command | Output/purpose |
| --- | --- |
| `node scripts/screenshots.ts` | Menu, race, garage, portrait and landscape captures in `docs/screenshots/` |
| `node scripts/reference-shot.ts` | Deterministic in-engine reference composition (its injected scene imports `./src/render/index.ts`, which does not exist in 1.4; import `renderer.ts` and `sprites.ts` before relying on this script) |
| `node scripts/native-assets.ts` | Web/native icons and splash screens from project vector art |

The local server must be running for game screenshots. Do not confuse a staged reference composition with a recorded gameplay session or earned unlocks.

## Release checks

Account validation uses `tests/auth.test.ts`, `tests/merge-progress.test.ts`,
MongoDB adapter tests, and `tests/browser/account.spec.ts` in Chromium/WebKit.
Verify unique normalized usernames, salted hashes, cookie expiry/revocation,
forged GUID rejection, guest/account merge retries, expired-session login and
logout cleanup across tabs. Browser account APIs run production handlers against
isolated fakes with live services disabled. Emulation is not a native cookie or
production HTTPS deployment verification.
`tests/browser/client-loading.spec.ts` checks that controllers avoid downloading
the game renderer and that an installed game reloads with its chunks offline.

1. Update affected canonical specs and roadmap status.
2. Run `npm run typecheck` and the checks relevant to changed behavior; confirm save compatibility and required assets.
3. Build from current source; sync native assets if native source is part of the change.
4. For hosted changes, preserve Site identity/audience and publish the artifact matching pushed source. Configure MongoDB/Redis on Node and `API_ORIGIN` on the optional Worker.
5. Verify returned deployment status; smoke-check changed hosted behavior where appropriate.
6. Record unverified physical-device/store/payment conditions explicitly.

Documentation-only work does not require deploying the game. Preserve source docs and art provenance when distributing the workspace.

## Native commands and limits

```powershell
npm run native:sync
npm run native:android
# On macOS with Xcode:
npm run native:ios
```

Android compilation requires JDK/Android SDK. iOS compilation/signing requires macOS/Xcode and an Apple team. Generated projects and successful Capacitor copy/sync are not equivalent to an installed, tested, signed APK/AAB/IPA. Required physical-device and store checks are defined in [NAT-01, NAT-02 and QA-01](09-roadmap.md).
