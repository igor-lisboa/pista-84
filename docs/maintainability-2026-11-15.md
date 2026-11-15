# Maintenance and vehicle visual audit — 2026-11-15

Scope: interface/material work plus project structure and fleet turn/shadow/reflection review. Vehicle IDs, tuning, prices, saves, APIs and storage contracts are preserved. The latest follow-up revises tilt help in all fifteen locales.

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

Implementation checks include focused simulation/progress and world tests; the production dependency audit reports zero vulnerabilities. The initial reflection check flagged two isolated cross-engine pixels. Reviewing the full-fleet contact sheet and gameplay captures found no visible defect; the differences came from comparing transparent Canvas RGB rather than the rendered color over asphalt. The assertion now composites against the road color and allows at most 3/255 per-channel rasterization variation. All four vehicle-ground cases pass across Chromium and WebKit.

Earlier validation on Node 24.22.2: build, strict typecheck, `docs:check` (22 catalog/tuning/audio rows, 37 documents, 267 local links), `quality:modules` (156 production modules) and all **181 Node tests pass**. The full configured browser suite completes with **375 passed, 0 failed and 3 skipped**; Windows WebKit does not support the three Web Audio cases, which run in Chromium. Full-fleet ground and gameplay captures were inspected, including all 22 models' straight/mild/strong poses, mirrored turns and dry/wet lighting. No additional Puma-specific or fleet-wide rendering defect was confirmed at that stage; the following enlarged review identifies further material defects.

Independent material fixtures were corrected where source inspection showed grille/wiper seams instead of body panels; the same assertions then pass **6/6** across both engines. All eight new platform lifecycle cases pass in the focused run.

Live services/deployed sockets, physical sensors/audio/wake lock, signed native builds and PWA chrome remain unverified. Six moderate development/native-tool dependency findings remain; upgrades need separate native build validation.

## Latest tilt, pairing and material follow-up

The earlier validation record above predates this follow-up. The player reports that pitching the screen toward/away steers the car. Sensor vectors use device coordinates while display rotation may lag: the [W3C coordinate-frame definition](https://www.w3.org/TR/orientation-event/) and [WebKit delayed-orientation report](https://bugs.webkit.org/show_bug.cgi?id=277878) support testing that compatibility case, rather than proving the exact failure on the player's phone. `WheelAxes` validates screen metadata against the viewport, uses a consistent legacy angle when available and keeps a stable device-axis fallback. This resolves display axes without learning a steering-center offset. Both sensor paths now reproduce neutral pitch with a stale zero-degree screen angle, including when orientation type updates first.

All fifteen `tilt.hold` translations now describe clockwise/right and counterclockwise/left wheel rotation while excluding front/back pitch. Pairing has a dedicated heading, a reserved close-button lane and a compact two-column landscape group. Phone menus keep the selected vehicle and footer inside visual-viewport height and camera/home safe areas; touch devices hide the keyboard-only hint.

Source review also finds and fixes Chevette lamp-housing metadata, muted Marea bumper paint and blue-grey motorcycle exhaust chrome. Every model publishes the same pose-region format, including asymmetric lamp housings. Independent fixtures verify actual panel hue for bright mint on white Uno panels and exhaust materials for every Hayabusa paint; these supplement the complete fleet/paint/pose/brake matrix.

Further enlarged source review identifies motorcycle plates receiving paint and normal-Uno side panels being excluded by a misplaced plate rectangle. `sprite-panels.ts` now holds shared pose-specific plate and body-panel data; motorcycle tail/cargo paint is separate from rider clothing. Normal and ladder Uno have different alpha-cropped plate/lamp positions. Amber-lens material detection covers the previously missed brown-orange shade. Source fixtures verify plates, indicator pixels, white side panels, neutral tails, cargo paint and rider helmets/clothing independently of runtime masks. The former broad rider-box assertion wrongly included cargo/tail paint: denim checks and direct garment fixtures replace that assumption.

The enlarged review additionally catches painted upper Uno wheel rims and a CG turn indicator outside its housing. Shared wheel ellipses protect the full visible rim, rather than only the bottom tire strip. Lamp metadata separates dedicated indicators and stacked amber bands from brake-emitting regions. Independent plate/rim/amber fixtures now compare both painted and braked output with the factory material. Region tables are created once; the per-pixel paint path does not allocate wheel tables or callbacks.

Final follow-up validation on Node 24.22.2: `npm run build`, `npm run typecheck`, `npm run docs:check` (22 catalog/tuning/audio rows, 37 documents, 304 local links), `npm run quality:modules` (158 production modules, no production/test overages) and all **184 Node tests** pass. The complete configured Chromium/WebKit run finishes **401 passed, 0 failed, 0 flaky and 3 skipped**, across 404 cases in 44 browser specs. The three unsupported Windows WebKit cases cover delayed audio unlock, brake-friction output and geared-engine switching; Chromium runs them. This includes the full fleet/paint/pose/brake matrix, upper rim/plate/amber fixtures, rider materials, pitch regressions and pairing composition across all fifteen locales. Full-fleet proportions, grounded turns, night/wet effects and the saved interface/material captures were reviewed. Physical iPhone/Android sensor behavior and native-speaker review remain QA-01/I18N-01; the interaction/hardware gaps listed above remain unverified.

## Reviewed follow-up captures

Captures are Chromium browser emulation; both configured engines execute the assertions. Pairing QR/link credentials are masked in saved evidence. Each paint sheet shows 17 garage choices followed by ten traffic colors; rows show straight, mild and strong poses, each with brakes off/on. Mirrored left turns are separately checked through actual Canvas output. The common-scale and ground captures supplement enlarged material sheets.

- Interface: [visual-viewport menu](screenshots/maintenance-v8/menu-visual-viewport.png), [desktop menu icons](screenshots/maintenance-v8/menu-icons-1440.png), [settings icons](screenshots/maintenance-v8/settings-icons-1440.png), [RTL settings](screenshots/maintenance-v8/settings-rtl-icons-1440.png).
- Pairing: [320x568](screenshots/maintenance-v8/pairing-320.png), [390x844](screenshots/maintenance-v8/pairing-390.png), [568x320](screenshots/maintenance-v8/pairing-568.png), [844x390](screenshots/maintenance-v8/pairing-844.png).
- Fleet: [common scale](screenshots/maintenance-v8/fleet-common-scale.png), [ground and reflections](screenshots/maintenance-v8/fleet-ground-night.png), [turning gameplay](screenshots/maintenance-v8/turning-gameplay-night.png).

| Model | All garage/traffic paints and brake states |
| --- | --- |
| Fusca | [Capture](screenshots/maintenance-v8/fusca-all-paints.png) |
| Brasilia | [Capture](screenshots/maintenance-v8/brasilia-all-paints.png) |
| Gol | [Capture](screenshots/maintenance-v8/gol-all-paints.png) |
| Palio | [Capture](screenshots/maintenance-v8/palio-all-paints.png) |
| Urban motorcycle | [Capture](screenshots/maintenance-v8/moto-all-paints.png) |
| SUV | [Capture](screenshots/maintenance-v8/suv-all-paints.png) |
| Kombi | [Capture](screenshots/maintenance-v8/kombi-all-paints.png) |
| Ladder Uno | [Capture](screenshots/maintenance-v8/uno-all-paints.png) |
| Normal Uno | [Capture](screenshots/maintenance-v8/uno-normal-all-paints.png) |
| Chevette | [Capture](screenshots/maintenance-v8/chevette-all-paints.png) |
| CG 125 | [Capture](screenshots/maintenance-v8/cg125-all-paints.png) |
| Opala | [Capture](screenshots/maintenance-v8/opala-all-paints.png) |
| Maverick | [Capture](screenshots/maintenance-v8/maverick-all-paints.png) |
| Fiat 147 | [Capture](screenshots/maintenance-v8/fiat147-all-paints.png) |
| Marea | [Capture](screenshots/maintenance-v8/marea-all-paints.png) |
| Passat | [Capture](screenshots/maintenance-v8/passat-all-paints.png) |
| Puma | [Capture](screenshots/maintenance-v8/puma-all-paints.png) |
| Veloce GT | [Capture](screenshots/maintenance-v8/gt-all-paints.png) |
| Raio sports motorcycle | [Capture](screenshots/maintenance-v8/superbike-all-paints.png) |
| Biz 125 | [Capture](screenshots/maintenance-v8/biz125-all-paints.png) |
| Hayabusa | [Capture](screenshots/maintenance-v8/hayabusa-all-paints.png) |
| Harley | [Capture](screenshots/maintenance-v8/harley-all-paints.png) |
