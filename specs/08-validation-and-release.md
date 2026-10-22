# 08 — Validation, operation and release

[Specification index](README.md)

## Local execution

Node.js **24** is the verified environment; service tests use `node:sqlite`.

```powershell
cd pista-84
npm install
npm run build
npm start
```

Open `http://localhost:4173`. `PORT` changes the port. For LAN testing, connect both devices to the same reachable server; allow its port on the private network. Tilt requires a secure context, so use the HTTPS publication or a suitable HTTPS proxy. Configure `PUBLIC_ORIGIN` to the external origin when proxying the Node server.

## Automated checks

```powershell
npm test
npx playwright install chromium webkit
npm run test:browser
```

The 1.3 baseline passed **22 unit/service tests + 16 browser cases = 38**. This records the previous implementation verification; a documentation-only update does not imply another execution of the game suite.

| Coverage | Required evidence |
| --- | --- |
| Simulation | Acceleration, fuel, distance, braking stop, collisions, pickup cap/consumption |
| State | Pause freezes progress; continuation is unique; restart/reset restores state |
| Vehicle differences | SUV resistance, motorcycle grip, catalog/audio profile coverage |
| Environment | Curve bounds/direction changes; continuous light/weather intensities |
| Progress | Malformed saves, ownership validation, migration, per-user backup and revision conflict |
| Room services | Memory and D1 adapters, token/role checks, atomic answer, expiration/deletion, compatibility input |
| Browser flows | Initial menu hides in race; pause/result/menu; vehicle and paint purchase persistence |
| Touch | Tap to start; independently held inputs; visible/hittable pedals; portrait/landscape viewport |
| Graphics | Eight atlas entries load; transparency and complete bodywork fit thumbnail bounds |
| Offline | Reload into a playable game with cached modules/artwork |
| Remote | Start/brake without RTCPeerConnection; loss pauses; new QR reconnects |

Chromium and WebKit projects run against the same local app. WebKit automation is evidence for that engine, **not a physical iPhone Safari certification**. The Windows WebKit test build lacks Web Audio; its graceful failure is checked without claiming audible output there.

## Hosted verification

The existing hosted verification helper checks health, D1 room creation/read/answer/delete, then pairs desktop Chromium with mobile WebKit, starts/brakes remotely and enters solo touch play. Its service credential is provided through hidden stdin and only attached to the intended Site origin. Never copy that credential into documentation, shell arguments or committed files.

The latest published visual baseline also received this hosted smoke check. It does not verify signed native builds, actual iPhone sensors, paid transactions or ad delivery.

## Visual review artifacts

| Command | Output/purpose |
| --- | --- |
| `node scripts/screenshots.mjs` | Menu, race, garage, portrait and landscape captures in `docs/screenshots/` |
| `node scripts/reference-shot.mjs` | Deterministic in-engine reference composition |
| `node scripts/native-assets.mjs` | Web/native icons and splash screens from project vector art |

The local server must be running for game screenshots. Do not confuse a staged reference composition with a recorded gameplay session or earned unlocks.

## Release checks

1. Update affected canonical specs and roadmap status.
2. Run checks relevant to changed behavior; confirm save compatibility and required assets.
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
