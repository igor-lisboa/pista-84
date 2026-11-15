# Maintenance and vehicle visual audit — 2026-11-15

Scope: all uncommitted interface/material work plus project structure and fleet turn/shadow/reflection review. Vehicle IDs, tuning, prices, saves, text, APIs and storage contracts are preserved.

## Findings and corrections

- Six oversized production modules mixed application, simulation and art responsibilities. Application services now own progress, platform, screens and onboarding; simulation delegates driving and entities; scene layers own projection, sky, weather, roadside and vehicles. City caches and art primitives have focused owners.
- The former Harley-only loading/fallback path becomes data in the shared atlas manifest and motorcycle painter registry. Explicit model artwork does not require another rendering pipeline.
- Puma's turn-frame lamp coordinates missed lenses, and yellow body was mistaken for brake lights. Factory-source masks keep lamps independent of paint. Rectangle protection left factory-color body patches around GT lamps; dark/neutral rules missed shaded Marea/Brasília and ladder Uno panels.
- Rectangular shadows and fixed-position road lights ignored vehicle proportions and turns. Source contact spans anchor uniformly scaled poses; subdued reflections follow actual lamp bounds and mirror with the sprite. Wet roads strengthen reflections. Turning no longer shrinks height by four percent.
- Checked native detection, install-prompt validation and unknown health-response narrowing replace duplicated unchecked boundaries. Depth-order tests observe actual Canvas submissions instead of private renderer methods.
- `npm run quality:modules` enforces the 299-line production limit. Oversized tests are split by behavior, preserving cases. The visual-quality workflow includes tire contact, shadows and dry/wet reflections.
- The roadmap's stale description of a free second chance is corrected to the existing 1,000 earned-coin behavior; this documentation correction does not change the economy or activate ads/payments.

## Interaction coverage inventory

The six production overages are reduced from their starting sizes as follows; extracted responsibilities remain separate modules, rather than omitted code.

| Coordinator/art module | Before | After |
| --- | ---: | ---: |
| `src/ui/game-app.ts` | 814 | 295 |
| `src/game/race.ts` | 420 | 237 |
| `src/render/renderer.ts` | 747 | 142 |
| `src/render/sprites.ts` | 584 | 49 |
| `src/render/procedural-cars.ts` | 466 | 243 |
| `src/render/scenery.ts` | 379 | 247 |

The former 623-line Node race test and 520-line browser game test now form focused files with the same 54 cases and titles. The suite contains 29 Node test files and 41 browser specs at this stage.

| Area | Automated evidence |
| --- | --- |
| Menu/dialog/settings/About/icons/safe areas | menu-spacing, icon-alignment, phone-dialogs, results, locale-fit |
| Tutorial/demo/welcome and close routes | tutorial, demo-guest, demo-transition, username |
| Keyboard/touch, driving, pause/results/second chance | game, mobile, results, race-continuation, tilt; platform-lifecycle adds Enter/modal ownership, desktop blur, touch blur and hidden-document input release |
| Fleet purchase/paint/persistence and artwork | garage-purchases, vehicle-paint-integrity, vehicle-ground, material-panels, fleet-proportions, harley, motorcycles, traffic-art, scene-rendering |
| Auth/identity/errors/conflicts/offline/outbox | account, username, progress-sync, save-conflict, client-loading and isolated Node persistence tests |
| Controller/pairing/input/disconnect/reconnect | controller-connection, controller-layout and Node room/socket/TTL tests |
| Fifteen locales/RTL/units | languages, tutorial, demo-transition, tilt-wheel |

Remaining coverage gaps are not proven defects: direct browser fullscreen acceptance/rejection; pointercancel/lost capture; downloadable export and malformed/oversize browser imports; account double-submit races; exhaustive keyboard focus restoration across every dialog; external GitHub navigation. Controlled visibility events do not certify a physical phone's background behavior.

## Validation record

Implementation checks: Node 24 locked install; build and strict TypeScript; focused 84 simulation/progress and 21 world checks; production dependency audit reports zero vulnerabilities. Initial material run passed 46 paint cases and exposed two ground-reflection mirror failures, under investigation. An earlier eight-case scene run stopped in setup while the new lamp module was being created; no behavior assertions were reached.

The final locked build and strict typecheck pass; all **180 Node tests pass** with no failures/skips. `quality:modules` checks **156 production modules**, with no production or test overages. `docs:check` passes for 22 catalog rows, 37 documents and 266 local links at this stage. Chromium/WebKit is running against the final code; its result and capture review will be recorded here.

The reflection diagnostic initially compared unpremultiplied RGB in almost-transparent pixels; opacity/composited-color checks distinguish visible differences. Cached source-space reflection textures also eliminate mirrored path rasterization differences and per-frame lamp gradient construction. Independent material fixtures were corrected where source inspection showed grille/wiper seams instead of body panels; the same assertions then pass **6/6** across both engines. All eight new platform lifecycle cases pass in the focused run.

Live services/deployed sockets, physical sensors/audio/wake lock, signed native builds and PWA chrome remain unverified. Six moderate development/native-tool dependency findings remain; upgrades need separate native build validation.
