# PISTA 84

Brazilian pixel-art endless racing arcade game. It runs in the browser, installs as a PWA, uses your phone as a remote controller, and has native Android/iOS projects (Capacitor).

Version 1.4: sunset arcade look (Bungee and Chakra Petch fonts, hard outlines and a checkered strip), 21 vehicles, heavier traffic, pace-based scoring, optional accounts with an online leaderboard, 15 languages and a procedural soundtrack. All code is TypeScript. See the [art direction](docs/ART_DIRECTION.md) and the [rendered composition](docs/screenshots/reference-scene.png).

## Table of contents

- [Quick start](#quick-start)
- [How to play](#how-to-play)
- [Phone as controller](#phone-as-controller)
- [Android and iOS](#android-and-ios)
- [Testing and publishing](#testing-and-publishing)
- [Project structure](#project-structure)
- [Documentation](#documentation)

## Quick start

Requires Node.js **24** or newer.

```powershell
npm install
npm run dev
```

Open **http://localhost:4173**. The terminal also shows the network address for accessing the game from your phone. Use `PORT` to change the port.

`npm run dev` builds the game before launching the local server. After editing `src/` or `web/`, stop the server with Ctrl+C and start it again, or run `npm run build` to refresh the assets while it is running. Production uses `npm start` after a build; it does not rebuild at startup and requires MongoDB and Redis. `www/` and `dist/` are generated; do not edit them. All code is TypeScript: Node 24 runs the `.ts` files directly (erasable syntax only, imports with the `.ts` extension), `tsc --noEmit` does the type checking, and esbuild bundles the browser app (`src/client.ts` and `web/sw.ts` into `www/game.js` and `www/sw.js`) and the Worker.

If startup reports **port 4173 is already in use**, an existing server is still running. Open http://localhost:4173, stop that server with Ctrl+C before starting another, or set a different `PORT` in `.env`.

### Run with Docker (no other infrastructure)

Only Docker (Compose 2.24+) and a bash shell (Git Bash on Windows) are needed: no Node, MongoDB or Redis on your machine.

```bash
bash scripts/local.sh up      # copies .env.example to .env.docker, builds, starts game + MongoDB + Redis
bash scripts/local.sh check   # live checks against the local services
bash scripts/local.sh test    # check + typecheck + Node tests inside the container
bash scripts/local.sh down    # stop (keeps data); "reset" also deletes the local database
```

Open **http://localhost:4173**. Options: `--port N`, `--lan` (publish for a phone) and `--force-env` (regenerate `.env.docker`). The databases are private to Docker and disposable; never put real credentials in `.env.docker`. Details and limits: [docs/STORAGE.md](docs/STORAGE.md#local-docker-stack).

## Local configuration (.env)

Progress is always saved locally first. Signed-in players upload automatically
when the game launches, pauses, ends a run, returns to the menu or leaves the page.
Five-second racing autosaves update localStorage and the persistent offline outbox
without calling APIs; reconnecting does not upload. Failed uploads stay queued for
the next event. Guests never contact the online API. Automatic snapshots are isolated
per player and device. See [storage and recovery details](docs/STORAGE.md).

The `.env` file at the root is read by the server and by the build. Use `.env.example` as a template:

```dotenv
PISTA84_COINS=10000
PORT=4173
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=pista84
REDIS_URL=redis://localhost:6379
```

`PISTA84_COINS` sets your balance when you open/reload the game and when you import progress or sign in, taking priority over the local balance and the cloud save. It accepts non-negative integers, including `0`. Leave it empty to use the saved balance. Purchases and earnings still change the balance during the session; reloading reapplies the configured value. Reading cloud progress does not change the record in the database. `PISTA84_PROGRESS_TOOLS=false` hides the garage export/import controls.

After editing `.env`, restart `npm run dev`. To generate the web, native or hosted files, run `npm run build` again. On the Worker, the `PISTA84_COINS` environment variable can override the build value. This setting applies to all players in that environment. Only `coins` and `progressTools` are exposed to the browser, through `GET /runtime-config.json` (served by Node and by the Worker and written to `www/` at build time, for the native apps); the app fetches this file on startup. Do not put secrets in it. `.env` is kept out of Git.

MongoDB stores scores, accounts, sessions and progress snapshots; Redis stores pairing rooms (10-minute TTL) and controller input (2-second TTL). Run `npm run online:check` to verify both configured services. See [storage and AI maintenance](docs/STORAGE.md). Codex reads `AGENTS.md`, Claude reads `CLAUDE.md`, and Copilot reads `.github/copilot-instructions.md`; repository skills and maintenance agents are included.

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
- **Off the asphalt** (the grass), speed is pulled down to 40 km/h in about half a second, the engine has almost no traction (10%), dust is kicked up, the screen shakes and the HUD warns "FORA DA PISTA" (Off track). Each excursion also costs 15% fuel, extra fuel while on the grass and 0.25 of the pace multiplier until the next checkpoint. Get back on the asphalt before accelerating again.
- **A checkpoint every 1 km** restores 4% of fuel and resets the kilometer clock (see scoring). The progress bar in the HUD shows the next checkpoint and the cyan mark indicates your record. Fuel cans on the track restore 12%, one every 12-17 s.
- **Pace-based scoring:** each meter is worth points multiplied by the average speed of the current kilometer: `multiplier = clamp(average km/h ÷ 120, 0.2, 3)`, reset at each checkpoint. The HUD shows the points and the multiplier (×1.0 = 100 km/h average). The end of the race shows points and the best score.
- **Coins come from score:** 1 coin for every 25 points. They are saved every 5 s of racing, on pause, at the end of the race and when returning to the menu.
- **Progressive difficulty:** over the first two minutes (120 s) of a race, traffic becomes more frequent, gets more pairs and trios in different lanes (at least two lanes are always left free, with a maximum of 16 cars) and gradually speeds up. Opponent speed is capped at 82% of the player's maximum and 85% of the vehicle's own maximum. Cars change lanes when there is room, follow the car ahead and never overlap. Pausing also pauses this progression. After the ramp, late-game pressure keeps building for four more minutes (up to 4 extra cars and quicker lane changes), then stops.
- **Speed and distance use the same measure:** at a constant 120 km/h, you cover 2 km per simulated minute. The camera closer to the ground reinforces the sense of speed without multiplying the mileage.
- A second chance costs 1,000 coins, once per race (3 s of invincibility). Buy coins in the main menu is for signed-in players; it is a disabled placeholder listing planned packs, and real-money coin packs are pending work until a provider is integrated.
- **Demo run:** the first run after the tutorial is a one-time demo with the Veloce GT (not added to the garage). Its first crash or empty tank ends the demo and later runs use your own car.
- **Speed feel:** lane markings pass twice as often as before, and the Veloce GT accelerates about 17 % faster to 100 km/h.
- During the race only the track, speed, distance, points, fuel and pause appear (top bar). Garage, options and language are in the start menu.
- **Account and ranking:** the first launch opens a tutorial followed by a one-time Veloce GT demo. Its result offers an optional account action; Settings and the ranking also provide login/signup. Guests play the full game offline with no sign-up. Only signed-in players publish to the online ranking (five drivers per page), sync progress and buy coins. Settings also offer km/mi units, the how-to-play tutorial, change password and log out.
- **Sound:** it starts on, but the browser only unlocks audio on the first tap or key press. A single button in Options turns music, engine and effects on/off, and the preference is remembered. The music is procedural (Web Audio, no files): a calm loop for menu/pause (74 bpm) and seven race tracks (Neon Highway 132 bpm, Turbo Rush 150, Sunset Drive 118, Nitro Circuit 142, Midnight Run 124, Checkered Flag 138 and Redline 160), one picked at random when the race starts, never the same as the previously picked one (when resuming after a pause, the race music restarts with a different track).
- **Languages:** fifteen, picked in Options: Portuguese (Brazil, the source), English, Portuguese (Portugal), French, Italian, Japanese, German, Spanish, Hindi, Simplified Chinese, Indonesian, Urdu (right-to-left), Bengali, Russian and Amharic. The default comes from `navigator.languages`; an unknown language falls back to English. The translations have not yet been reviewed by native speakers.

**Garage:** 21 vehicles with distinct performance, size, braking and audio, listed by price. All are bought with coins, from the free Fusca 76 up to the Raio 1000 (20,000) and the Veloce GT (30,000, 350 km/h). Motorcycles have a smaller collision area but lose more grip in the rain. All vehicles use authored sprites with straight and turning frames. There are 17 paint options (factory plus 16 bought with coins).

**Progress:** the save lives in the browser and works offline; export and import it from the garage. Signed-in players also keep a cloud account save (MongoDB) that is merged with the device save at login. The save (v2) stores coins, distance and score records, vehicles, paints, sound, language, units, pilot name and sync identity.

**Phone:** pedals in the bottom-right corner and arrows in the bottom-left, in portrait or landscape; the arrows disappear while tilt is on. Tilt is optional, requires HTTPS and permission, is for landscape play, reads the phone roll from gravity and has neutral-position calibration. Phone dialogs fill the screen, and pinch zoom, double-tap zoom and text selection are blocked outside form fields. The standalone game installs as a PWA and works offline after the first visit. Open Settings > Install game to install through the browser prompt, or see instructions for adding it to the Home Screen on iPhone. The button indicates when running as an installed app.

## Billboard ads

Billboards appear every 228 meters, alternating sides of the track. The sample texts are in [`src/render/billboards.ts`](src/render/billboards.ts): edit `title`, `subtitle`, `background` and `foreground` to apply a sponsor's identity, then run `npm run build`. The text fits the billboard width; prefer short titles.

The pieces are local and work offline. Paid serving, metrics and integration with an ad network are not implemented yet.

## Phone as controller

1. Open the hosted game on the computer and click **Controle no celular** (Phone controller).
2. Scan the QR code with the phone. The phone needs no account; pairing uses the room token in the QR code.
3. Wait for the connection, close the modal on the computer and start the race (or tap **Iniciar corrida** (Start race) on the controller).
4. Use the arrows and pedals, or enable tilt.

- **Connection:** pairing uses three HTTP calls; ongoing control uses `/api/controller` WebSockets on every browser, including Safari. Redis stores expiring room/presence/input state and relays commands between server instances through Pub/Sub. No room polling or HTTP input loop runs during play. Lost sockets reconnect automatically; a disconnect pauses the race until the player resumes.
- **Security:** the QR code expires in 10 minutes and allows one connection. It uses neither camera nor microphone. Signal loss pauses the race; generate another QR code to reconnect.
- **iPhone:** open the HTTPS address directly in Safari and scan a freshly generated QR code. Tilt only asks for access when you tap the button. Automated validation uses WebKit; testing on a physical device is still needed.
- **Local execution:** Node uses Redis for signaling when configured (memory only for local development without Redis), and replaces `localhost` with the detected network address. With multiple interfaces, check the address. The firewall must allow the port on the private network. To use sensors, serve Node behind HTTPS and set `PUBLIC_ORIGIN` to the external URL.
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

- `npm run typecheck` checks the project after building. `npm test` runs the isolated Node tests (167 at the last documented run), including persistence concurrency, accounts and API behavior. `npm run test:browser` runs Chromium/WebKit Playwright specs with live databases disabled.
- All code, comments, identifiers, test names and server/API error messages are in English; the player-visible text lives in `src/i18n/locales/*.ts`.
- The build generates the web/native assets in `www/` and the ESM Worker in `dist/server/index.js`.
- The Worker serves static assets and proxies online APIs to a Node/Vercel deployment configured with `API_ORIGIN`. MongoDB and Redis run behind the Node APIs; the Worker has no D1 binding. Preserve the project ID in `.openai/hosting.json`.
- `bash scripts/local.sh check` and `test` verify the game against the Docker stack's own MongoDB and Redis (`scripts/check-local.ts` plus `npm run online:check`); they never touch real services.
- See [storage setup and consistency](docs/STORAGE.md) for MongoDB collections, Redis TTLs, live checks and deployment settings.
- Accounts use salted scrypt hashes and hashed server-side sessions in a Secure, HttpOnly cookie; scores and progress writes need a session. Scores remain client-reported and this is casual game progress, not a secure wallet. The service worker never caches APIs or tokens. Credentials stay on Node, and only public configuration reaches the browser.
- Payments, ads and the premium wallet still depend on providers and commercial setup: coin packs will only be sellable once a billing integration exists. The current backup is meant for casual progress and does not make local coins a secure wallet for real money.
- Helper scripts (Node 24, with the local server running when they open the game): `node scripts/screenshots.ts` (captures in `docs/screenshots/`), `node scripts/reference-shot.ts` (reference scene), `node scripts/native-assets.ts` (icons and splash screens) and `node scripts/verify-hosted.ts` (hosted site verification, configuration via stdin).

## Project structure

| Path | Contents |
| --- | --- |
| `src/game/` | Pure simulation, no DOM: cars, vehicle tuning, environment, road, scoring, traffic, race, save, merge, units, username and `index.ts` (barrel) |
| `src/render/` | Canvas renderer, scenery, sprites (atlas and procedural), billboards and noise |
| `src/audio/` | Audio engine, procedural music player and track data |
| `src/i18n/` | Translator, types and fifteen `locales/*.ts` (pt-BR is the source; pt-PT is partial) |
| `src/ui/` | Orchestrator (`game-app`), HUD, input, overlays, options, account, leaderboard, tutorial, about, garage, phone dialog, controller page, notifications, car art and DOM |
| `src/net/` | Pairing and controller commands (`remote.ts`, `room-api.ts`, `room-socket.ts`), account client and progress sync outbox |
| `src/server/` | Accounts, sessions, player API, MongoDB durable storage, Redis rooms and sockets, room protocol and edge API proxy |
| `src/shared/config.ts` | Public configuration (`PISTA84_COINS`, `PISTA84_PROGRESS_TOOLS`) |
| `src/client.ts`, `src/qr.ts` | Browser entry point and QR generation |
| `web/` | HTML, CSS, manifest, icons, vehicle atlas and `sw.ts` (service worker) |
| `api/` | Vercel Node functions (health, auth, account, progress, score, leaderboard, rooms, controller) |
| `worker/index.ts` | Static Worker/API proxy |
| `dev-server.ts`, `production-server.ts` | Local and production launchers for the shared `scripts/node-server.ts` HTTP/WebSocket server |
| `Dockerfile`, `docker-compose.yml`, `scripts/local.sh` | Local Docker stack: game, MongoDB and Redis from one script |
| `scripts/*.ts` | Build, environment, native assets, captures and hosted verification |
| `tests/` | Node tests (`*.test.ts`), `tests/support/` and Playwright tests (`tests/browser/*.spec.ts`) |
| `tsconfig.json`, `playwright.config.ts` | Configuration |
| `android/`, `ios/` | Native projects (Capacitor) |
| `www/`, `dist/` | Build output (generated) |
| `specs/`, `docs/` | Specifications (source of truth) and documentation |
| `.agents/`, `.claude/`, `.github/` | AI maintenance skills and agents (see `AGENTS.md`) |

## Documentation

- **[Game specifications — start here](specs/README.md)**
- [Game rules](specs/02-gameplay.md)
- [Vehicles and economy](specs/03-vehicles-and-economy.md)
- [Architecture and data](specs/06-architecture-and-data.md) and [remote control and API](specs/07-remote-control-api.md)
- [Pending work and acceptance criteria](specs/09-roadmap.md)
- [Art direction and prompts](docs/ART_DIRECTION.md)
- [Pending work (contracts, dependencies and completion tests)](docs/PENDING.md)

`docs/SPECS.md` and `docs/PENDING.md` are navigation pointers (the latter has a summary of what is still missing); the specifications in `specs/` are the source of truth and must be updated together with the code.

`npm run docs:check` validates catalog/tuning/audio tables, version/cache baselines, translation counts, source references and local links. It also runs before `npm test`; prose and behavior still need the maintenance skill audit.
