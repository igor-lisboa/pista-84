# 08 — Validation, operation and release

[Specification index](README.md)

## Local execution

Node.js **24** is the verified environment: it runs the TypeScript sources natively and the service tests use `node:sqlite`.

```powershell
npm install
npm run build
npm start
```

`npm start` (and `npm run dev`) run `node server.ts` and serve the generated `www/`, so build first. Open `http://localhost:4173`. `PORT` changes the port. For LAN testing, connect both devices to the same reachable server; allow its port on the private network. Tilt requires a secure context, so use the HTTPS publication or a suitable HTTPS proxy. Configure `PUBLIC_ORIGIN` to the external origin when proxying the Node server.

## Automated checks

```powershell
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:browser
```

- `npm run typecheck` is `tsc --noEmit -p .` (strict, erasable syntax only, `.ts` import extensions) over sources, tests, scripts, worker and config files. It is clean on 1.4.0.
- `npm test` is `node --test tests/*.test.ts`. The 1.4 suite has **54 tests**: `race.test.ts` 27, `world.test.ts` 11, `traffic.test.ts` 6, `i18n.test.ts` 5, `signaling.test.ts` 2 (memory and D1/SQLite modes), `cloud.test.ts` 1 and `config.test.ts` 1. Shared helpers are in `tests/support/` (seeded random, `quietRace`, traffic/fuel factories, a `node:sqlite` D1 adapter).
- `npm run test:browser` runs the Playwright specs in `tests/browser/` (`game.spec.ts` 13 cases, `mobile.spec.ts` 3) in the Chromium and WebKit projects (the app server is started by `npm start`, and reused if already running). `tests/browser/support/harness.ts` bundles `harness-entry.ts` with esbuild and injects it as `window.Pista` so cases can call the game, renderer and sprite modules from `page.evaluate`.

The suite was last run in full (Node tests) on 1.4.0 with all **54 passing**; the browser cases are listed here but a documentation-only update does not imply another execution.

| Coverage | Required evidence (test file) |
| --- | --- |
| Simulation | Acceleration, brake/throttle/coast, fuel, distance, braking stop, pickup cap/consumption, 350 km/h Veloce GT, 120 km/h = 2 km per minute (`race.test.ts`) |
| Crashes and off-road | Any traffic contact is fatal, barrier crash except after the second chance, grass drag to about 40 km/h, 10% traction, single `offroad` event, braking on the shoulder (`race.test.ts`) |
| Score and economy | Pace multiplier bounds, per-km reset, coins from score (`race.test.ts`, `world.test.ts`) |
| State | Pause freezes progress; continuation is unique; restart/reset restores state (`race.test.ts`, `world.test.ts`) |
| Traffic | All five lanes, distinct-lane waves, ramp and caps, gradual speed changes, lane changes without overlap, 16-car cap (`traffic.test.ts`) |
| Vehicles and audio | 14 distinct cars, exactly two premium cash cars, one engine voice per car, motorcycle rain grip, menu and race music tracks (`world.test.ts`, `race.test.ts`) |
| Environment | Road bounds/direction changes by seed; continuous light/weather intensities (`world.test.ts`) |
| Progress | Malformed saves, ownership validation, migration, sound default and language, balance override, per-user backup and revision conflict (`world.test.ts`, `cloud.test.ts`, `config.test.ts`) |
| Languages | Fifteen languages offered; full locales cover every key with the same placeholders; no unknown keys; browser language mapping (`i18n.test.ts`) |
| Room services | Memory and D1 adapters, token/role checks, atomic answer, expiration/deletion, compatibility input, cross-origin/oversized/invalid JSON rejection (`signaling.test.ts`) |
| Browser flows | Initial menu hides in race; pause/result/menu; barrier crash screen; off-road drag; language switch; vehicle and paint purchase persistence with premium cars refused; fuel exhaustion gives one continuation (`game.spec.ts`) |
| Touch | Tap to start; pedals bottom-right and arrows bottom-left with the HUD clear of both corners; landscape pedals in view; no scroll (`mobile.spec.ts`) |
| Graphics | All 14 vehicles draw complete, unclipped sprites; eight straight sprites and sixteen turn frames are complete and distinct; five lanes with four dividers; balance override (`game.spec.ts`) |
| Offline | Reload into a playable game with cached modules/artwork; sound toggle degrades gracefully (`game.spec.ts`) |
| Remote | Start/brake over the HTTPS relay without RTCPeerConnection; loss pauses; new QR reconnects (`game.spec.ts`) |

Chromium and WebKit projects run against the same local app. WebKit automation is evidence for that engine, **not a physical iPhone Safari certification**. The Windows WebKit test build lacks Web Audio; its graceful failure is checked without claiming audible output there.

## Hosted verification

The hosted verification helper (`node scripts/verify-hosted.ts`, configuration `{ url, token }` as one JSON line on stdin) checks health, D1 room creation/read/answer/delete, then pairs desktop Chromium with mobile WebKit, starts/brakes remotely and enters solo touch play. Its service credential is provided through hidden stdin and only attached to the intended Site origin. Never copy that credential into documentation, shell arguments or committed files.

The 1.3 published visual baseline received this hosted smoke check; no hosted run is recorded for 1.4. It does not verify signed native builds, actual iPhone sensors, paid transactions or ad delivery.

## Visual review artifacts

| Command | Output/purpose |
| --- | --- |
| `node scripts/screenshots.ts` | Menu, race, garage, portrait and landscape captures in `docs/screenshots/` |
| `node scripts/reference-shot.ts` | Deterministic in-engine reference composition (its injected scene imports `./src/render/index.ts`, which does not exist in 1.4; import `renderer.ts` and `sprites.ts` before relying on this script) |
| `node scripts/native-assets.ts` | Web/native icons and splash screens from project vector art |

The local server must be running for game screenshots. Do not confuse a staged reference composition with a recorded gameplay session or earned unlocks.

## Release checks

1. Update affected canonical specs and roadmap status.
2. Run `npm run typecheck` and the checks relevant to changed behavior; confirm save compatibility and required assets.
3. Build from current source; sync native assets if native source is part of the change.
4. For hosted changes, preserve Site identity/audience and publish the artifact matching pushed source. Apply only new database migrations.
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
