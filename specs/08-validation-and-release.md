# 08 — Validation, operation and release

[Specification index](README.md)

## Local execution

Node.js **24** is the verified environment: it runs the TypeScript sources natively.

```powershell
npm ci
npm run build
npm run dev
```

`npm run dev` builds (the `predev` script) and runs `node dev-server.ts`, which starts `scripts/node-server.ts` to serve the generated `www/` and the APIs. Open `http://localhost:4173`. `PORT` changes the port. Without `MONGODB_URI`/`REDIS_URL` the local server serves the game with cloud features disabled and memory-only pairing. For LAN testing, connect both devices to the same reachable server; allow its port on the private network. Tilt requires a secure context, so use the HTTPS publication or a suitable HTTPS proxy. Configure `PUBLIC_ORIGIN` to the external origin when proxying the Node server.

### Local stack with Docker

Docker with Compose 2.24+ and a bash shell are enough; no Node, MongoDB or Redis is installed on the host:

```bash
bash scripts/local.sh up      # writes .env.docker from .env.example, builds, starts, waits until healthy
bash scripts/local.sh check   # live checks against the local MongoDB and Redis
bash scripts/local.sh test    # check + typecheck + Node tests inside the container
bash scripts/local.sh down    # stop (reset also deletes the local database)
```

Open `http://localhost:4173`. Options (`--port N`, `--lan`, `--force-env`), design and limits are in [storage](../docs/STORAGE.md#local-docker-stack).

Production uses `npm run build` followed by `npm start` (`node production-server.ts`).
Heroku builds through `heroku-postbuild` and starts through the `Procfile`, with no
runtime rebuild. Configure MongoDB, Redis and the external HTTPS `PUBLIC_ORIGIN`;
Heroku supplies `PORT`. See [Heroku configuration](../docs/STORAGE.md#heroku).

## Automated checks

```powershell
npm run build
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:browser
```

- `npm run build` must run before type checking: it generates the Worker asset module that `tsc` needs.
- `npm run typecheck` is `tsc --noEmit -p .` (strict, erasable syntax only, `.ts` import extensions) over `api`, `src`, `tests`, `scripts`, `worker`, `web/sw.ts`, `dev-server.ts`, `production-server.ts` and `playwright.config.ts`. It is clean on 1.4.0.
- `npm test` runs `node --test tests/*.test.ts`: 166 isolated Node tests in 24 files (the count changes as coverage grows). No normal test loads live storage credentials; storage doubles live in `tests/support/`.
- `npm run test:browser` runs the Playwright specs in `tests/browser/` in Chromium and WebKit (the app server is started by `npm run dev`, with live databases disabled, `PISTA84_PROGRESS_TOOLS=true` and no existing server reused). Most specs start from `tests/browser/support/signed-in.json` (a returning, signed-in player); `username.spec.ts` opts out to see first launch, and `account.spec.ts` routes API calls to the production handlers over isolated fakes (`support/account-backend.ts`). `tests/browser/support/harness.ts` bundles `harness-entry.ts` with esbuild and injects it as `window.Pista` so cases can call the game, renderer and sprite modules from `page.evaluate`.

Run `npm run build`, `npm run typecheck` and `npm test` for current evidence. Run `npm run online:check` when validating configured MongoDB/Redis, using removable probe records. `bash scripts/local.sh check` (or `npm run local:check` inside the app container) runs the same live diagnostics plus an end-to-end smoke test against the Docker stack's own disposable services; it is never part of `npm test`.

| Coverage | Required evidence (test file) |
| --- | --- |
| Simulation | Acceleration, brake/throttle/coast, per-vehicle taper, fuel (rest, cans, checkpoints), distance, braking stop, 350 km/h Veloce GT, 120 km/h = 2 km per minute, lanes and contact plane (`race.test.ts`, `vehicle-refinement.test.ts`) |
| Crashes and off-road | Any traffic contact is fatal, barrier crash except after the second chance, grass drag to about 40 km/h, 10% traction, single `offroad` event, braking on the shoulder, grass fuel and multiplier penalty with cooldown and floor (`race.test.ts`) |
| Score and economy | Pace multiplier bounds, per-km reset, coins from score, second chance costs 1,000 coins (`race.test.ts`, `world.test.ts`) |
| State | Pause freezes progress; reset restores state; a new run seeds opening traffic (`race.test.ts`, `traffic.test.ts`, `world.test.ts`) |
| Traffic | All five lanes, distinct-lane waves, ramp and caps, paints, gradual speed changes, lane changes without overlap, 16-car cap, frozen while paused (`traffic.test.ts`) |
| Vehicles and audio | 18 distinct coin cars, one engine voice per car, menu and race music tracks, geared engines (`world.test.ts`, `vehicle-refinement.test.ts`) |
| Environment | Road bounds/direction changes by seed; local-clock start, per-run weather, continuous light/weather intensities (`world.test.ts`) |
| Progress | Malformed saves, ownership validation, migration, sound default and language, balance override, GUID/username/units/timestamps, import rules, past players (`world.test.ts`, `cloud.test.ts`, `config.test.ts`) |
| Accounts | Password rules, scrypt parameters, atomic unique usernames, session rotation/expiry/revocation, HTTPS requirement, shared attempt budgets, forged-GUID rejection, password change, MongoDB account adapters and indexes (`auth.test.ts`, `mongo-accounts.test.ts`, `mongo-store.test.ts`) |
| Reconciliation and ranking | Idempotent guest/account merge, later spending preserved, newer other-tab save kept, guest-row absorption and shadow-row retirement, paged leaderboard without GUIDs (`merge-progress.test.ts`, `score-cleanup.test.ts`, `cloud.test.ts`, `mongo-store.test.ts`) |
| Automatic snapshots | Uploads only at permitted boundaries; local queueing never requests during play; failed outbox survives reload and retries; resumed play defers a pending PUT; device/manual isolation and stale writes; logout cancels uploads (`progress-sync.test.ts`, `browser/progress-sync.spec.ts`) |
| Languages | Fifteen languages offered; every full locale (all except pt-PT) covers every key with the same placeholders; no unknown keys; no emoji; browser language mapping (`i18n.test.ts`, `browser/languages.spec.ts`) |
| Room services | Room protocol, token/role checks, atomic answer, expiration/deletion, cross-origin/oversized/invalid JSON rejection, no implicit memory fallback, socket auth/relay/reconnect/expiry (`signaling.test.ts`, `rooms-api.test.ts`, `redis-config.test.ts`, `room-sockets.test.ts`) |
| Deployment | Production configuration validation, Heroku origin handling and launch, Vercel layout and entrypoint naming, edge proxy fail-closed/cookies/WebSocket upgrade (`node-config.test.ts`, `node-deployment.test.ts`, `vercel-config.test.ts`, `proxy.test.ts`) |
| Browser game flows | Initial menu hides in race; pause/result/menu; barrier crash screen; off-road drag; language switch; vehicle and paint purchase persistence with unaffordable cars refused; balance override; reload offline; cross-tab save safety (`game.spec.ts`, `results.spec.ts`, `save-conflict.spec.ts`, `timestamps.spec.ts`) |
| Browser account flows | First-launch sign-up/log-in/offline entry, duplicate username, password change, merge/retry/expired session, logout across tabs, guest ranking message and paged ranking (`username.spec.ts`, `account.spec.ts`, `leaderboard.spec.ts`) |
| Tutorial, units and install | Five-step tutorial and idle prompt, km/mi, install prompt and iPhone instructions (`tutorial.spec.ts`, `install-depth.spec.ts`) |
| Touch and layout | Tap to start; pedals bottom-right and arrows bottom-left with the HUD clear of both corners; landscape layouts; tilt landscape prompt; controller layout; stable HUD frames; phone settings/garage layout (`mobile.spec.ts`, `tilt-landscape.spec.ts`, `controller-layout.spec.ts`, `layout.spec.ts`, `phone-screens.spec.ts`, `garage-progress.spec.ts`) |
| Graphics | All 18 vehicles draw complete, unclipped sprites; straight and turn frames are complete and distinct; five lanes with four dividers; traffic paint and depth order; vehicle sizes and fog (`game.spec.ts`, `vehicle-refinement.spec.ts`, `traffic-art.spec.ts`, `install-depth.spec.ts`, `vehicle-weather.spec.ts`) |
| Audio | A delayed unlock cannot override a sound-off choice; braking, throttle and effect levels (`audio.spec.ts`) |
| Lazy loading and offline | Controller does not download the game renderer; the installed game reloads with its chunks offline (`client-loading.spec.ts`, `game.spec.ts`) |
| Local stack | Compose pins private MongoDB/Redis URLs and publishes only the game port; the Dockerfile ignores secrets; `scripts/local.sh` rewrites every `.env.example` key it depends on with LF endings; the smoke check refuses non-local services and cleans up (`local-stack.test.ts`). Live: health, assets, guest 401s, account signup/login/logout, score and leaderboard, progress revisions and device snapshots, account reconciliation, room claim and WebSocket input through Redis (`scripts/check-local.ts`, run by `local.sh check`) |
| Remote | Socket start/brake without RTCPeerConnection; exactly three pairing HTTP calls and no polling; automatic socket reconnect, safe pause and new QR (`game.spec.ts`, `room-sockets.test.ts`) |

Chromium and WebKit projects run against the same local app. WebKit automation is evidence for that engine, **not a physical iPhone Safari certification**. The Windows WebKit test build lacks Web Audio; its graceful failure is checked without claiming audible output there.

## Hosted verification

### Optional accounts, demo run, phone layout and tilt (2026-11-13)

- `npm run typecheck`, `npm run build` and `npm test` passed: 166 Node tests, including the new `tests/tilt.test.ts` (gravity lean sign and past-90° behavior) and `tests/demo-run.test.ts` (demo flag migration, import and merge rules).
- Playwright in Chromium passed all 92 tests, including `browser/demo-guest.spec.ts` (guest offline play, guest shop and ranking notices, the one-time demo and the guest enter option), `browser/phone-dialogs.spec.ts` (iPhone SE portrait and landscape: full-screen dialogs, the shop fitting short landscape, zoom and selection guards) and the updated first-launch, account and shop specs.
- The first full WebKit run reported 86 passed and 3 failed. Two failures were test-expectation fixes and the third (the signed-in shop) was fixed in its spec; all three then passed on rerun. The camera-frame test in `game.spec.ts` also passed on rerun, so it is recorded as flaky under load, not as a regression.
- Not verified: physical iPhone SE or Android hardware, real gravity and motion sensors, the lock behavior of installed apps, and how the cornering squeal and braking sound sound through a phone speaker. These stay in QA-01.

The dated sections below are **historical snapshots**; their test counts were true on those dates (the current count is in *Automated checks*). They are kept as evidence of what each change was verified against.

### Docker local stack (2026-11-10)

- Verified on Docker Desktop for Windows with Git Bash: `bash scripts/local.sh up` built the image and reached healthy MongoDB, Redis and app containers; `local.sh check` passed `online:check` and every `check-local.ts` step and left no probe records; `local.sh test` passed `npm run typecheck` and all 158 Node tests inside the container; `reset` removed containers, network and volume.
- Not covered: Linux/macOS hosts, `--lan` phone pairing, HTTPS/tilt, and the Playwright browser suite (it keeps its own isolated server and fakes). No deployment or commit was made.

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
The current contract uploads only for signed-in players at launch, pause, game end, menu return and page exit, with local-only racing autosaves; see the *Automatic snapshots* row above.

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

The hosted verification helper (`node scripts/verify-hosted.ts`, configuration `{ url, token }` as one JSON line on stdin) checks health, shared room creation/read/answer/delete, then pairs desktop Chromium with mobile WebKit, starts/brakes remotely and enters solo touch play. Its service credential is provided through hidden stdin and only attached to the intended deployment origin. Never copy that credential into documentation, shell arguments or committed files.

No hosted run is recorded for 1.4. The helper does not verify signed native builds, actual iPhone sensors, paid transactions or ad delivery.

## Visual review artifacts

| Command | Output/purpose |
| --- | --- |
| `node scripts/screenshots.ts` | Menu, race, garage, portrait and landscape captures in `docs/screenshots/` |
| `node scripts/reference-shot.ts` | Deterministic in-engine reference composition (`docs/screenshots/reference-scene.png`), bundled from `renderer.ts`, `sprites.ts` and `game/index.ts` |
| `node scripts/review-driving.ts`, `node scripts/review-brazilian-cars.ts` | Driving-pose and Brazilian-car review captures under `docs/screenshots/` |
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

1. Update affected canonical specs, docs and roadmap status in the same change.
2. Run `npm run typecheck` and the checks relevant to changed behavior; confirm save compatibility and required assets.
3. Build from current source; sync native assets if native source is part of the change.
4. For hosted changes, deploy the build that matches the pushed source and keep `PUBLIC_ORIGIN` correct (see [Heroku configuration](../docs/STORAGE.md#heroku)). Configure MongoDB/Redis on Node and `API_ORIGIN` on the optional Worker.
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
