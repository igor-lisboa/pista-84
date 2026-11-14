# Wheel tilt and Veloce GT review — 2026-11-14

## Diff-to-spec audit

- Spec 03: GT acceleration is 150, with max 350 km/h, gain 0.36, falloff 0.5 and price 30,000 unchanged. Real Race measurements at 20 ms, centered/dry, without traffic and with unlimited fuel give 0–100/70%/90%/95% at 1.92/5.62/9.90/12.90 s. Initial pull is 54 km/h/s; acceleration stays positive below maximum and zero at maximum. Current acceleration, Brazilian-car and Uno references agree. Saved IDs and earlier Puma/Hayabusa edits are preserved.
- Spec 04: level landscape is the absolute wheel center. The first tilted sample steers immediately; holding a turn never learns a new center. Gravity roll maps both landscape orientations/platform signs, with 25-degree full lock, 0.06 dead zone and 45 ms exponential filtering. Near-flat readings tend to neutral; non-finite data is rejected. Orientation-only fallback converts beta/gamma into gravity before mapping roll.
- Settings/controller calibration controls are removed. Legacy translation keys remain, with no calibration UI using them. Revised hold instructions cover all fifteen locales including pt-PT; counts stay 252 source keys / 185 pt-PT overrides. Sensor silence disables tilt after five seconds and refreshes an open settings switch. Permission failure leaves buttons available.
- Specs 04/07: the enabling tap requests fullscreen where needed, then landscape. Disable/denial releases owned resources; late completion is cleaned up. Existing fullscreen is preserved. Unsupported locks retain the portrait blocker. A portrait controller sends neutral drive/start plus pause; Use buttons escapes, and the host resumes only from explicit start/continue. Transport/message shape are unchanged.
- Spec 06/index: cache `pista84-v33` refreshes the client. Input merging, sensor lifetime, wheel math and landscape/fullscreen ownership use focused modules. Roadmap, matrix, README, interface guide and module debt match. Application/save versions remain 1.4.0/2; no backend/environment/commercial changes.

## Standards and limits

The projection follows the [W3C device-orientation coordinate system and rotation order](https://www.w3.org/TR/orientation-event/). The derived gravity vector is `[-cos(beta) × sin(gamma), sin(beta)]`; yaw does not affect it. Native locking follows the [W3C Screen Orientation API](https://www.w3.org/TR/screen-orientation/): browsers may require fullscreen or reject locking. The portrait fallback does not override unsupported OS rotation behavior. Physical Android/iOS sensors, native builds and speakers remain QA-01; native-speaker review stays I18N-01.

## Executed checks

- Node 24.22.2, unchanged installed dependencies: production build, strict typecheck, docs checks and all 177 Node tests in 25 files pass, no failures/skips. `node scripts/measure-acceleration.ts` produces the GT times above.
- `playwright test tests/browser/tilt-wheel.spec.ts tests/browser/tilt-landscape.spec.ts tests/browser/controller-layout.spec.ts tests/browser/mobile.spec.ts tests/browser/demo-guest.spec.ts tests/browser/languages.spec.ts tests/browser/phone-screens.spec.ts tests/browser/client-loading.spec.ts tests/browser/audio.spec.ts --workers=4`: 54 pass, two unsupported Windows WebKit audio skips, no final failures.
- Coverage includes first-sample steering, return to center, both landscape grips/signs, filtering/invalid/flat input, orientation-only fallback, lock/fullscreen ownership, late lock after disable, denial, timeout and switch recovery; controller portrait pause, button escape/resume, touch release, guest/demo flow, localized help geometry, Urdu physical controls, settings/garage and offline reload.
- Every locale fits 375x667, 667x375, 768x1024, 1024x768, 900x1440 and 1440x900. Retained [portrait](screenshots/tilt-wheel-2026-11-14/help-portrait.png) and [landscape](screenshots/tilt-wheel-2026-11-14/help-landscape.png) show the final Amharic iteration; this is layout evidence, not editorial sign-off.
- Initial lock tests mocked the document root before parsing created it. The fixture now stubs the Element prototype and supplies deterministic permissions. The old batch was stopped; every corrected case passes in the final run. Controller fixtures supply continuing sensor samples and use the portrait escape hatch. No assertion or timeout is weakened.
- Diff whitespace checks pass; docs checks validate catalog/tuning/audio facts, cache/version/save baseline, locale counts, source references and links.

## Quality boundaries

Input merging falls to 129 lines; tilt control/math/lock are 95/63/46, settings 230, controller 104. New implementations stay below 299 lines without new `any` or suppressions; external readings/permission results are checked. GameApp remains an existing 814-line overage, with one settings-refresh call through the existing dialog boundary. Six production overages remain QLT-01; large existing test/data files are not global compliance claims.

This is affected-scope emulation, not the whole browser suite, live-service, hardware or native certification. Payments and ads remain pending.
