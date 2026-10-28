# PISTA 84

Brazilian pixel-art endless racing arcade game. It runs in the browser, installs as a PWA, uses your phone as a remote controller, and has native Android/iOS projects (Capacitor).

Version 1.4: sunset arcade look (Bungee and Chakra Petch fonts, hard outlines and a checkered strip), 14 vehicles, heavier traffic, pace-based scoring, 15 languages and a procedural soundtrack. All code is TypeScript. See the [art direction](docs/ART_DIRECTION.md) and the [rendered composition](docs/screenshots/reference-scene.png).

## Table of contents

- [Quick start](#quick-start)
- [How to play](#how-to-play)
- [Phone as controller](#phone-as-controller)
- [Android and iOS](#android-and-ios)
- [Testing and publishing](#testing-and-publishing)
- [Project structure](#project-structure)
- [Documentation](#documentation)

## Quick start

Requires Node.js **24** (the validated environment, including the SQL tests with `node:sqlite`).

```powershell
npm install
npm start
```

Open **http://localhost:4173**. The terminal also shows the network address for accessing the game from your phone. Use `PORT` to change the port.

`npm start` and `npm run dev` build the game before launching the local server. After editing `src/` or `web/`, stop the server with Ctrl+C and start it again, or run `npm run build` to refresh the assets while it is running. `www/` and `dist/` are generated; do not edit them. All code is TypeScript: Node 24 runs the `.ts` files directly (erasable syntax only, imports with the `.ts` extension), `tsc --noEmit` does the type checking, and esbuild bundles the browser app (`src/client.ts` and `web/sw.ts` into `www/game.js` and `www/sw.js`) and the Worker.

If startup reports **port 4173 is already in use**, an existing server is still running. Open http://localhost:4173, stop that server with Ctrl+C before starting another, or set a different `PORT` in `.env`.

## Local configuration (.env)

The `.env` file at the root is read by the server and by the build. Use `.env.example` as a template:

```dotenv
PISTA84_COINS=10000
PORT=4173
```

`PISTA84_COINS` sets your balance when you open/reload the game and when you import or restore progress, taking priority over the local balance and the database backup. It accepts non-negative integers, including `0`. Leave it empty to use the saved balance. Purchases and earnings still change the balance during the session; reloading reapplies the configured value. Reading the backup does not change the record in the database; saving to the cloud remains a manual action.

After editing `.env`, restart `npm start`. To generate the web, native or hosted files, run `npm run build` again. On the Worker, the `PISTA84_COINS` environment variable can override the build value. This setting applies to all players in that environment. Only this balance is exposed to the browser, through `GET /runtime-config.json` (served by Node and by the Worker and written to `www/` at build time, for the native apps); the app fetches this file on startup. Do not put secrets in it. `.env` is kept out of Git.

## How to play

| Action | Keyboard |
| --- | --- |
| Steer | ←/→ or A/D |
| Accelerate | ↑ or W |
| Brake | ↓, S or space |
| Start / continue | Enter |
| Pause | P or Esc |

- Hold ↑ / W or ACELERAR (Accelerate) to gain speed. Releasing the accelerator slows the car down; the brake reduces speed more sharply. Stopping lets you resume the race without a game over.
- **Curves push the car outward:** the sharper the curve and the higher the speed, the more you need to steer or brake. Curves show up on the horizon and move toward the car, and the curve warning blinks when you need to brake.
- **Every crash is fatal:** touching a traffic car or the outer barrier ends the race immediately, with no speed threshold, no lives and no bounce. The "VOCÊ BATEU!" (You crashed!) screen shows the impact speed. The other way to lose is running out of fuel.
- **Off the asphalt** (the grass), speed is pulled down to 40 km/h in about half a second, the engine has almost no traction (10%), dust is kicked up, the screen shakes and the HUD warns "FORA DA PISTA" (Off track). Get back on the asphalt before accelerating again.
- **A checkpoint every 1 km** restores 15% of fuel and resets the kilometer clock (see scoring). The progress bar in the HUD shows the next checkpoint and the cyan mark indicates your record. Fuel cans on the track restore 32%.
- **Pace-based scoring:** each meter is worth points multiplied by the average speed of the current kilometer: `multiplier = clamp(average km/h ÷ 100, 0.2, 3.5)`, reset at each checkpoint. The HUD shows the points and the multiplier (×1.0 = 100 km/h average). The end of the race shows points and the best score.
- **Coins come from score:** 1 coin for every 25 points. They are saved every 5 s of racing, on pause, at the end of the race and when returning to the menu.
- **Progressive difficulty:** over the first four minutes (240 s) of a race, traffic becomes more frequent, gets more pairs and trios in different lanes (at least two lanes are always left free, with a maximum of 16 cars) and gradually speeds up. Opponent speed is capped at 82% of the player's maximum and 85% of the vehicle's own maximum. Cars change lanes when there is room, follow the car ahead and never overlap. Pausing also pauses this progression.
- **Speed and distance use the same measure:** at a constant 120 km/h, you cover 2 km per simulated minute. The camera closer to the ground reinforces the sense of speed without multiplying the mileage.
- A second chance costs 1,000 coins, once per race (3 s of invincibility). Buy coins in the main menu shows planned packs; real-money purchases are unavailable until a provider is integrated.
- During the race only the track, speed, distance, points, fuel and pause appear (top bar). Garage, options and language are in the start menu.
- **Sound:** it starts on, but the browser only unlocks audio on the first tap or key press. A single button in Options turns music, engine and effects on/off, and the preference is remembered. The music is procedural (Web Audio, no files): a calm loop for menu/pause (74 bpm) and three race tracks (Neon Highway 132 bpm, Turbo Rush 150 bpm, Sunset Drive 118 bpm), one picked at random when the race starts, never the same as the previously picked one (when resuming after a pause, the race music restarts with a different track).
- **Languages:** Portuguese (Brazil), English, Portuguese (Portugal), French, Italian, Japanese and German, in Options. The default comes from `navigator.languages`; an unknown language falls back to English. The translations have not yet been reviewed by native speakers.

**Garage:** 14 vehicles with distinct performance and audio. Regular cars are unlocked with coins; the two PREMIUM ones (Veloce GT, R$ 29.90, and Raio 1000, R$ 19.90) can only be bought with real money through the `CashStore` interface (`src/ui/store.ts`). No payment provider is connected: the default store reports "unavailable" and the game shows a notice. Motorcycles have a smaller collision area but lose more grip in the rain. The six new vehicles (Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS and Maverick GT) use procedural pixel-art sprites, still without atlas art. There are five paint jobs that can be bought with coins.

**Progress:** export and import your progress in the game. On the hosted site there is a manual per-account backup, with protection against write conflicts. Restoring a backup replaces the data on the device. The save (v2) stores coins, distance and score records, vehicles, paints, sound and language.

**Phone:** pedals in the bottom-right corner and arrows in the bottom-left, in portrait or landscape; the arrows disappear while tilt is on. Tilt is optional, requires HTTPS and permission, and has neutral-position calibration. The standalone game installs as a PWA and works offline after the first visit. Open Settings ? Install game to install through the browser prompt, or see instructions for adding it to the Home Screen on iPhone. The button indicates when running as an installed app.

## Billboard ads

Billboards appear every 228 meters, alternating sides of the track. The sample texts are in [`src/render/billboards.ts`](src/render/billboards.ts): edit `title`, `subtitle`, `background` and `foreground` to apply a sponsor's identity, then run `npm run build`. The text fits the billboard width; prefer short titles.

The pieces are local and work offline. Paid serving, metrics and integration with an ad network are not implemented yet.

## Phone as controller

1. Open the hosted game on the computer and click **Controle no celular** (Phone controller).
2. Scan the QR code with the phone. On the private site, sign in with the same account on both devices.
3. Wait for the connection, close the modal on the computer and start the race (or tap **Iniciar corrida** (Start race) on the controller).
4. Use the arrows and pedals, or enable tilt.

- **Connection:** pairing uses HTTP/D1. Commands use WebRTC when possible, with an HTTPS fallback (Safari starts in compatibility mode), so TURN is not needed. The original WebSocket relay remains at `/relay` as a technical alternative.
- **Security:** the QR code expires in 10 minutes and allows one connection. It uses neither camera nor microphone. Signal loss pauses the race; generate another QR code to reconnect.
- **iPhone:** open the HTTPS address directly in Safari and scan a freshly generated QR code. Tilt only asks for access when you tap the button. Automated validation uses WebKit; testing on a physical device is still needed.
- **Local execution:** Node keeps signaling in memory and replaces `localhost` with the detected network address. With multiple interfaces, check the address. The firewall must allow the port on the private network. To use sensors, serve Node behind HTTPS and set `PUBLIC_ORIGIN` to the external URL.
- The remote controller in the native wrapper uses the web version until there is specific validation.

## Android and iOS

The projects are in `android/` and `ios/`, with their own icons and splash screens.

```powershell
npm run native:sync
npm run native:android
# On macOS with Xcode:
npm run native:ios
```

- Android requires the JDK and Android SDK; iOS requires macOS and Xcode. Neither is available in this environment.
- There is no validated APK/AAB/IPA nor signing certificates (NAT-01/NAT-02 in the [roadmap](specs/09-roadmap.md)).
- To regenerate icons and splash screens from the project SVG: `node scripts/native-assets.ts` (requires Playwright's Chromium).

## Testing and publishing

```powershell
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:browser
```

- `npm run typecheck` runs `tsc --noEmit` on the whole project. `npm test` runs `node --test tests/*.test.ts`: **61 tests** covering simulation, traffic, world/save/audio, i18n, signaling, backup and configuration. `npm run test:browser` runs 35 Playwright cases (`tests/browser/*.spec.ts`) in Chromium and WebKit; they bundle with esbuild a *harness* that exposes `window.Pista` (game modules, renderer and sprites) to `page.evaluate`. The local server starts by itself (`npm start`), and builds the assets automatically.
- All code, comments, identifiers, test names and server/API error messages are in English; the player-visible text lives in `src/i18n/locales/*.ts`.
- The build generates the web/native assets in `www/` and the ESM Worker in `dist/server/index.js`.
- The Worker serves the game, `/runtime-config.json`, pairing (`/api/rooms`), backup (`/api/progress`) and `/health`. Sites provisions the D1 binding `DB` and applies the migrations in `drizzle/`. Preserve the project ID in `.openai/hosting.json`.
- To change the schema: edit `db/schema.ts`, run `npm run db:generate` and inspect the new migration. Do not edit migrations that have already been applied.
- Only the Sites gateway should provide identity to the Worker; local Node does not accept backup through identity headers. No secret is kept in the frontend. The offline cache (service worker `pista84-v10`) covers only local assets, with no APIs or tokens; Google Fonts are optional, with a fallback to system fonts, and are not cached.
- Payments, ads and the premium wallet still depend on providers and commercial setup: the PREMIUM cars will only be sellable once a billing integration implements `CashStore`. The current backup is meant for casual progress and does not make local coins a secure wallet for real money.
- Helper scripts (Node 24, with the local server running when they open the game): `node scripts/screenshots.ts` (captures in `docs/screenshots/`), `node scripts/reference-shot.ts` (reference scene), `node scripts/native-assets.ts` (icons and splash screens) and `node scripts/verify-hosted.ts` (hosted site verification, configuration via stdin).

## Project structure

| Path | Contents |
| --- | --- |
| `src/game/` | Pure simulation, no DOM: cars, environment, road, scoring, traffic, race, save and `index.ts` (barrel) |
| `src/render/` | Canvas renderer, scenery, sprites (atlas and procedural), billboards and noise |
| `src/audio/` | Audio engine, procedural music player and track data |
| `src/i18n/` | Translator, types and `locales/*.ts` (pt-BR is the source; en, pt-PT, fr, it, ja, de) |
| `src/ui/` | Orchestrator (`game-app`), HUD, input, overlays, options, garage, phone dialog, controller page, notifications, `store` (`CashStore`), car art and DOM |
| `src/net/remote.ts` | Pairing client (WebRTC and HTTPS fallback) |
| `src/server/` | Room signaling, cloud backup and D1 types (shared by Node and the Worker) |
| `src/shared/config.ts` | Public configuration (`PISTA84_COINS`) |
| `src/client.ts`, `src/qr.ts` | Browser entry point and QR generation |
| `web/` | HTML, CSS, manifest, icons, vehicle atlas and `sw.ts` (service worker) |
| `worker/index.ts`, `db/`, `drizzle/` | Worker (game, pairing, backup), D1 schema and migrations |
| `dev-server.ts` | Local Node server (static files, in-memory signaling, `/runtime-config.json`, `/network`, `/qr`, WebSocket relay) |
| `scripts/*.ts` | Build, environment, native assets, captures and hosted verification |
| `tests/` | Node tests (`*.test.ts`), `tests/support/` and Playwright tests (`tests/browser/*.spec.ts`) |
| `tsconfig.json`, `drizzle.config.ts`, `playwright.config.ts` | Configuration |
| `android/`, `ios/` | Native projects (Capacitor) |
| `www/`, `dist/` | Build output (generated) |
| `specs/`, `docs/` | Specifications and documentation |

## Documentation

- **[Game specifications — start here](specs/README.md)**
- [Game rules](specs/02-gameplay.md)
- [Vehicles and economy](specs/03-vehicles-and-economy.md)
- [Pending work and acceptance criteria](specs/09-roadmap.md)
- [Art direction and prompts](docs/ART_DIRECTION.md)
- [Pending work (contracts, dependencies and completion tests)](docs/PENDING.md)

`docs/SPECS.md` and `docs/PENDING.md` are legacy paths (the latter has a summary of what is still missing); the canonical definitions are in `specs/`.
