# Demo transition review — 2026-11-14

## Behavior and diff audit

Spec 04 defines a single transition note on the first completed demo result. `src/ui/game-app.ts` captures whether the finished run was the demo before consuming its existing flag. `src/ui/overlays.ts` receives the next selected vehicle name, shows the localized note and groups the demo summary for responsive layout. Later results receive no note. Restart, menu, account and paid second chance keep their existing handlers; the note opens no extra dialog and does not overwrite saved selection. Fusca 76 remains the default starting vehicle.

The note explains that the GT was a demo loan, introduces the player's journey with the selected vehicle, and mentions racing, earning coins and growing the garage. `demo.transition` has an explicit translation with the same `{car}` placeholder in all fifteen locales, including pt-PT. Current source count is 252 keys; pt-PT explicitly overrides 185. Native-speaker approval remains I18N-01.

`web/style.css` highlights the note and groups demo results into summary/actions columns in landscape. Compact demo-only rules keep longer translations visible at 320x568 and 568x320 without changing ordinary result layout. The interface guide, roadmap, requirement UX15 and baseline match; cache `pista84-v30` refreshes the updated client/styles. No save schema, economy, physics, endpoints or environment settings change.

## Executed checks

- Existing Node 24.22.2 dependency installation is reused with an unchanged lockfile. Production build, strict typecheck, documentation gate and all 170 Node tests pass.
- `playwright test tests/browser/demo-transition.spec.ts tests/browser/demo-guest.spec.ts tests/browser/phone-dialogs.spec.ts tests/browser/client-loading.spec.ts --workers=4`: all 52 Chromium/WebKit cases pass; no skips or failures in the final run.
- The real guest flow completes the GT demo, checks the exact transition text naming Fusca 76, restarts, finishes another race and verifies the note is absent. A focused result test checks a different selected vehicle name and later-note removal. All fifteen locales keep the note and every result action inside eight viewports: 320x568, 568x320, 375x667, 667x375, 768x1024, 1024x768, 900x1440 and 1440x900.
- Shared checks cover ordinary results, dialog scrolling and offline installed reload/start. [Portrait](screenshots/demo-transition-2026-11-14/portrait.png) and [landscape](screenshots/demo-transition-2026-11-14/landscape.png) captures retain the final Amharic iteration as complex-script layout evidence.
- Initial checks caught overflowing demo summaries at the smallest sizes and long desktop translations. Separate demo summary grouping and compact spacing resolve them. A real-flow assertion initially inspected an old hidden result before the next crash; it now waits for the result overlay to become visible. Assertions remain intact. The final 52-case run includes every corrected case.

## Scope and limits

Result presentation stays in the focused 88-line overlay module. Existing application orchestration remains 813 lines and the shared CSS remains oversized; a broad lifecycle/style decomposition is outside this small behavior change and stays under QLT-01. The application change only captures/passes existing demo state; no extra abstraction is introduced. Previous working-tree changes are preserved.

This is affected-flow browser emulation, not a full repository quality audit, physical-device test or native-speaker review. Physical/native review remains QA-01; payments/ads stay pending. Earlier performance/motorcycle validation is historical evidence for that delivery, not the current translation/cache count.
