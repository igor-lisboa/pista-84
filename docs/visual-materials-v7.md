# Vehicle materials and icon alignment — 2026-11-15

This is the earlier review record. The subsequent [maintenance audit](maintainability-2026-11-15.md) supersedes its current implementation findings with source material masks, shared ground effects and further visual corrections; the captures below remain historical evidence.

The supplied Veloce turning screenshot exposed generic brake rectangles crossing
the rear body. `sprite-brakes.ts` now creates a cached braked version of the
authored pose, brightening existing warm lens pixels only inside reviewed rear
lamp regions. Shape, alpha, perspective and left-turn mirroring follow the source
art. No rectangle or separate glow is projected over the vehicle.

`sprite-materials.ts` owns model/pose lens protection, rubber/neutral wheel shades,
glass reflections and bike rider regions. Paint still shifts body hue/lightness,
including dark and white paints. The initial visual contact review also caught
motorcycle trousers sharing the body hue; rider-leg regions now retain their
factory colors. Existing catalog tuning, IDs, prices and ownership do not change.
The weak brake-tile cache shares the lifetime of its source sprite, so the pixel
processing happens when a pose/paint is first used rather than every frame.

Icon-only controls now use explicit zero-padding centered grid cells. Menu action
icons have a fixed centered trailing slot; settings/close/pause controls use the
same alignment review. Tests found default pause-button padding causing a two to
three pixel shift on phones/laptop landscape; this is corrected as well.

## Repeatable review

The new canonical [visual-quality skill](../.agents/skills/pista-visual-quality/SKILL.md)
and Claude/Copilot review agents require viewport screenshots plus material/pose
inspection. Vehicle and completion-quality skills route to this check for future
vehicle, paint and interface work. The skill validator passes. No new bitmap art,
translation keys or gameplay rules are introduced.

`vehicle-paint-integrity.spec.ts` checks 22 vehicles × 27 palette entries (17
garage choices including factory paint, plus 10 traffic colors) × three authored
poses. It checks lens/tire/rider preservation, unchanged alpha, actual body-paint
variation and brake activity contained in the lamp regions. Both brake states are
also drawn in mirrored left/right turns and compared pixel-for-pixel with nearest
neighbor rendering, matching production. That covers 5,940 direction/color/brake
render combinations per engine. Each vehicle produces a contact sheet: palette
entries run left to right, and each pose has coast/brake rows. The factory-pose
sheet reviews all 66 original crops at a larger size.

Geometry checks locate defects but cannot independently certify semantic mask
boundaries; visual contact-sheet and gameplay-scale review remain required by the
skill. Browser emulation is not a physical display or native-device certification.
The existing oversized shared sprite orchestrator remains QLT-01; material and
brake responsibilities are extracted into focused modules below 300 lines.

## Verification record

Build, strict typecheck, documentation audit and 180 Node tests pass on Node
24.22.2. Initial mirror comparisons used default canvas smoothing and detected
resampling differences; the review now uses the same nearest-neighbor setting as
production. Icon checks exposed and corrected the pause-button padding defect.
The first broad browser run had 114 passes, nine failures and one unsupported
Windows WebKit audio skip. Failures identified the short-menu footer overflow,
fractional-resampling mirror comparisons and one overloaded WebKit driving click.
The footer/icon slot is corrected; exact mirror comparison uses source resolution;
driving passes with two workers and the original timeout/assertions.

The corrected affected run passes **133 cases, fails none and skips one** Windows
WebKit Web Audio case. This includes all icon/menu/mobile/dialog checks and the
complete vehicle matrix. Visual review then refined the dark-material guard so
Harley's teal panels recolor fully, plus the normal Uno's pose-specific plate
exclusion. The final material/traffic/Harley rerun passes **56/56** cases; the final
Harley bag-height refinement passes **10/10** affected cases. The panel-coverage
check requires over 70% of sampled touring-panel pixels to change in each custom
paint, in addition to lamp/tire protection. No required affected check remains
failing. This is affected-scope verification, not the whole repository browser suite.

```text
npx playwright test tests/browser/vehicle-paint-integrity.spec.ts tests/browser/traffic-art.spec.ts tests/browser/icon-alignment.spec.ts tests/browser/harley.spec.ts tests/browser/vehicle-refinement.spec.ts tests/browser/layout.spec.ts tests/browser/menu-spacing.spec.ts tests/browser/phone-dialogs.spec.ts tests/browser/client-loading.spec.ts tests/browser/mobile.spec.ts --workers=2
npx playwright test tests/browser/vehicle-paint-integrity.spec.ts tests/browser/traffic-art.spec.ts tests/browser/harley.spec.ts --workers=2
npx playwright test tests/browser/vehicle-paint-integrity.spec.ts tests/browser/harley.spec.ts --grep 'harley:|Harley' --workers=2
```

The [capture directory](screenshots/materials-v7/) retains all 22 full-palette
contact sheets, the [66 factory crops](screenshots/materials-v7/factory-poses.png)
and centered-icon captures at [desktop](screenshots/materials-v7/menu-icons-1440.png),
[laptop landscape](screenshots/materials-v7/menu-icons-800.png) and
[phone](screenshots/materials-v7/menu-icons-375.png) sizes. Representative revised
materials: [Veloce](screenshots/materials-v7/gt-all-paints.png),
[Uno](screenshots/materials-v7/uno-normal-all-paints.png),
[urban bike](screenshots/materials-v7/moto-all-paints.png) and
[Harley](screenshots/materials-v7/harley-all-paints.png).

Final diff review maps UI to spec 04, material/rendering changes to specs 03/05/06,
checks to spec 08 and workflow/evidence to the roadmap, matrix and baseline.
Cache `pista84-v37` delivers the updated code/CSS offline. `sprites.ts` remains
584 lines under QLT-01; the new material/brake modules are 70/24 lines. No new
unsafe casts, typing suppressions or simulation/DOM coupling are introduced.
