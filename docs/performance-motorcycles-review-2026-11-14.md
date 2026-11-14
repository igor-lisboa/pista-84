# Performance, motorcycles and account-note review — 2026-11-14

This is a historical snapshot of that delivery. The later demo-transition change adds one translation key and advances the offline cache; current counts and baseline are in specs 04 and the specification index.

## Diff-to-spec audit

| Area | Definition and evidence |
| --- | --- |
| Account hint | Spec 04: `src/ui/settings.ts` renders the existing optional-account wording only for guests. Browser signup tests check both account states in both iPhone SE orientations. |
| Economy/catalog | Spec 03: ladder Uno is 3,200 coins; Maverick remains 1,600. Uno tuning, IDs and owned saves stay intact. Biz 125 and Hayabusa bring the catalog to 21; Node tests cover acceleration, price ordering and saved ownership/import. Browser tests buy both and reselect an already-owned Uno without charging again. |
| Performance | Specs 02/05/06: road surface batches preserve row geometry and pixels; projection buffers/depths are reused; seeded section cache holds at most eight entries; sprite caches evict one oldest item rather than clearing their entire warm contents. Physics, camera, spawn rules, visual resolution and time-step limits are unchanged. |
| Art/audio | Spec 05 and [motorcycle provenance](motorcycles-v1.md): six transparent new atlas cells, distinct authored turns and mirrored left turns, uniform sizing, paint masks preserving helmets/mirrors/lenses, brake lamps and distinct geared harmonic profiles. Full source URLs and generation prompt are retained. |
| Localization | Spec 04 and language guide: two new taglines in all fifteen locales, including pt-PT. Source has 251 keys; pt-PT overrides 184. All fifteen are checked for garage text overflow at phone portrait/landscape, tablet portrait and desktop landscape; Urdu driving directions stay physical. Native editorial review is pending. |
| Offline | Spec 06/index: cache `pista84-v29` includes the new atlas and prior menu stylesheet; offline reload/start tests pass. Save format 2 and application version 1.4.0 remain unchanged. |

Roadmap, matrix, README, pending summary and current catalog/audio/tuning counts match the implementation. Earlier dated test counts and provenance remain historical evidence.

## Measurements and commands

- Node 24.22.2; dependency installation was already verified in this workspace with the unchanged lockfile. Production build, strict typecheck, documentation checks and all 170 Node tests in 25 files pass (no Node failures/skips).
- `playwright test tests/browser/motorcycles.spec.ts tests/browser/render-budget.spec.ts tests/browser/vehicle-refinement.spec.ts tests/browser/vehicle-weather.spec.ts tests/browser/traffic-art.spec.ts tests/browser/install-depth.spec.ts tests/browser/phone-screens.spec.ts tests/browser/languages.spec.ts tests/browser/client-loading.spec.ts tests/browser/audio.spec.ts tests/browser/garage-progress.spec.ts --workers=4`: 67 passed, three skipped. Skips are WebKit audio cases on this Windows build without Web Audio.
- Final scope: `playwright test tests/browser/game.spec.ts tests/browser/traffic-art.spec.ts tests/browser/motorcycles.spec.ts tests/browser/render-budget.spec.ts --grep 'production atlas|menu disappears|barrier ends|leaving the road|new models|offline cache|every vehicle|preserve the complete|road renders|traffic paint|new motorcycles drive|batched road|environment balance' --workers=4`: 28 passed, no skips/failures. This rechecks the final cache change, all 21 complete/distinct vehicle poses, camera resizing, five lanes, purchases/balance override, offline play, grass slowdown, crashes, pause and both new bikes driving in both phone orientations.
- `node scripts/measure-acceleration.ts` measures Biz 0–100 at 22.48 s and Hayabusa at 2.84 s; full 70/90/95% times are in [acceleration-v6.md](acceleration-v6.md).
- The pixel-reference check compares four curved/distance compositions at 960×720 in both engines: zero changed channels, ten batched paint submissions, fewer than 1% of the original row submissions. Timing is not used as a flaky pass/fail gate.
- An exploratory Chromium submission probe (150 frames, first 30 discarded, empty traffic, moving curved road) measured mean submission time 5.95→4.93 ms at normal CPU and 27.82→22.83 ms with CDP 4× CPU throttling; median 1.0→0.8 ms and 4.6→3.5 ms respectively. These single local samples precede the final incremental-cache change; deferred Canvas/raster work makes tail timings variable. They are indicative CPU-work evidence, not hardware FPS guarantees.
- `git diff --check` passes. The documentation gate validates catalog/tuning/audio tables, locales, cache/version/save baseline, source references and local links.

## Findings corrected during validation

The first new acceleration test omitted throttle input; the fixture now uses the same real acceleration input as the measurement script. New purchase tests initially expected selection to close the garage; they now explicitly close it and verify reload persistence. Old shared garage/game tests still expected 18 cars and the ladder Uno's 120-coin price; fixtures now use 21 cars, a sufficient wallet and the 3,200-coin debit. Several returning-player fixtures also needed tutorial/demo completion. The first expanded game batch was stopped after identifying these stale fixtures, then its complete selected scope passed. No assertion is removed or timeout relaxed to conceal a runtime failure.

Screenshot review caught a driving fixture being overwritten by page-exit saving. It now seeds selection before page load and asserts the bike name before starting. Paint review also caught tinted helmet/mirror/lamp pixels; the new bike masks preserve those areas. Corrected [pose contact sheet](screenshots/motorcycles-v1/vehicle-poses.png), [Biz portrait gameplay](screenshots/motorcycles-v1/biz125-375x667.png) and [Hayabusa landscape gameplay](screenshots/motorcycles-v1/hayabusa-667x375.png) are retained.

## Quality boundaries and remaining limits

New implementation modules are focused and below 299 lines: road surface 87, sprite paint 155 and engine voices 87. Audio orchestration is 212 lines. Existing renderer (747) and sprite orchestration/fallbacks (615) remain oversized after extracting the touched responsibilities; further decomposition stays QLT-01. Existing large browser/catalog/locale files are test/data volume, not a claim of global size compliance. No new unsafe suppression or `any` is introduced; extracted legacy audio/color helpers retain their existing internal assertions.

This is an affected-scope review, not the entire repository browser suite. Live services, remote pairing, physical speakers, real low-end devices, native builds and native-speaker review are not certified. Bundle/download reduction is not claimed: the new requested artwork adds an atlas; the existing lazy client split remains. Less repeated rendering work helps weaker devices, but identical FPS across hardware is not promised. The existing 50 ms simulation-step cap is unchanged; severe sustained stalls still need hardware investigation under QA-01. Payments and ads remain pending.
