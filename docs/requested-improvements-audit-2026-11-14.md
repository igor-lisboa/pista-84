# Requested improvements audit — 2026-11-14

This audit traces the complete group of requested menu, account, performance, vehicle, demo and tilt changes to current source, specifications and automated checks. Earlier focused reviews remain the detailed evidence for [performance and motorcycles](performance-motorcycles-review-2026-11-14.md), the [demo transition](demo-transition-review-2026-11-14.md), [Hayabusa and Biz](motorcycles-v1.md), [Harley](harley-v1.md) and the [Brazilian cars](brazilian-cars-v1.md).

## Request-by-request result

| Request | Current result and evidence |
| --- | --- |
| Portrait menus need breathing room and centered items; main menu needs a useful landscape layout | Safe-area-aware spacing and centered menu tracks are defined in `web/style.css` and `web/menu-layout.css`. Browser layout cases cover phone portrait/landscape, tablets and desktop. |
| Show the optional-account hint only while logged out | Settings derives the hint from current account state. `motorcycles.spec.ts` checks guest and signed-in states in both iPhone SE orientations. |
| Reduce play-time work for weaker devices | Road drawing batches paths, projection storage is reused, world-section caching is bounded and sprite recolors use incremental eviction. The controller and game remain separately lazy-loaded and installed chunks work offline. This reduces repeated CPU/allocation work; it does not promise identical FPS on different hardware. |
| Ladder Uno must cost more than Maverick | Ladder Uno is 3,200 coins; Maverick is 1,600. Their IDs, tuning and existing ownership remain compatible. |
| Add a very fast motorcycle and a normal Brazilian-culture motorcycle | Hayabusa and Biz 125 have authored turn poses, garage copy in all 15 locales, paint/brake support, distinct engine profiles and persistence coverage. Hayabusa is the requested arcade 370 km/h model. |
| Explain the end of the first demo and the start of the Fusca journey | The first completed Veloce GT demo result explains the loan and names the saved next vehicle (Fusca 76 for a new save). The note is localized across all 15 locales and does not recur. |
| Puma GT at 250 km/h and acceleration 45; Veloce/Ferrari acceleration 150 | Catalog, audio ceiling, measured acceleration documentation, garage values and simulation tests agree. |
| Tilt should behave like an F1 wheel, need no calibration and require landscape | Wheel steering uses the phone held screen-facing the player, level landscape as center, with the final steering sign matching an F1-style wheel rotation. Calibration UI is absent. Portrait tilt blocks play and attempts the available fullscreen/orientation lock; unsupported lock is handled explicitly. |
| Add a large old-school Harley | Harley Electra Glide is a 6,000-coin, 165 km/h touring motorcycle with authored poses, paint/brake support and a V-twin sound profile. The revised asset reduces the rider relative to the large bike and luggage. |
| Respect camera cutouts and rounded phone corners | Every full-screen UI layer consumes the four CSS safe-area insets. Dialogs, HUD, controls, menu and overlays stay inside the resulting safe rectangle; recent portrait and landscape iPhone-like inset cases are automated. |
| Make vehicle and rider sizes coherent | `vehicle-scale.ts` gives authored motorcycles one rider-relative logical scale while keeping model aspect ratios. The Harley remains deliberately large and the CG 125 is a compact commuter; cars continue using their tuned widths. Browser checks compare rendered dimensions and all authored poses. |
| Center race-end text in portrait | The result summary is vertically centered within the safe rectangle and scrolls internally if content exceeds a very small screen. Tests cover 320×568 and modern phone-safe-area portrait layouts. |

## Review boundaries

The browser tests emulate CSS safe-area values, screen shapes, sensors and orientation APIs. They cover both Chromium and WebKit, but cannot certify a physical camera cutout, OEM orientation-lock behavior, real gyroscope direction, native packaging, speakers or sustained FPS on a specific low-end phone. Those checks remain under QA-01. Real-money packs, ads and payments remain intentionally pending.

## Completion evidence

The final review used Node 24.22.2 and a clean `npm ci` from the lockfile. `npm run build`, strict `npm run typecheck` and `npm run docs:check` passed; the documentation audit covered 22 catalog/tuning/audio rows, 34 documents and 239 local links. All **180 Node tests passed** with no skips. The complete configured Playwright run finished with **295 passes, 0 failures and 3 skips**; the skips are the three Web Audio cases unsupported by Windows WebKit. Chromium executes those audio cases.

`npm audit --omit=dev` reports no production vulnerabilities. The full audit reports six moderate findings in development/native tooling (`@capacitor/cli` through `xcode`/`uuid`, plus `glob`/`minimatch`/`rimraf`); none are shipped browser/server production dependencies, and they were recorded rather than applying an unrequested dependency upgrade.

The touched scale/math/art helpers are below 300 lines. `src/render/sprites.ts` remains an existing oversized shared atlas module; the new scale responsibility was extracted to `vehicle-scale.ts`, and the remaining overage stays tracked under QLT-01. `game.spec.ts` is an oversized test-data/flow file, reported separately from production implementation debt. Final `git diff --check` passes.
