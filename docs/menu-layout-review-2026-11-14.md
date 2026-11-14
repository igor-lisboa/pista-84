# Menu layout review — 2026-11-14

## Scope and diff audit

- Spec 04 owns centered portrait menus, breathing room, fluid landscape columns and compact portrait dialog/pause centering. Long settings, About and garage content retains top-first scrolling.
- `web/menu-layout.css` contains responsive composition separately from the racing HUD. `web/style.css` imports it. The existing shared stylesheet remains above 299 lines; broader stylesheet decomposition is outside this layout change. No production TypeScript module is expanded; existing TypeScript debt remains under QLT-01.
- `web/sw.ts` caches the new stylesheet and advances the cache to `pista84-v28`; specs 06 and the index match. Save format and application version remain unchanged.
- The requirements matrix, interface guide and roadmap describe the delivered layout. No player wording, translations, vehicle values, settings, API or storage contracts change.

## Checks and findings

- Node 24.22.2: dependency installation, production build, strict typecheck, documentation consistency and 167 Node tests pass, with no Node failures or skips.
- The initial Chromium/WebKit layout run passed 48 cases and failed four new menu cases: remote-control actions clipped at 320x568 and 568x320 in both engines. Compact portrait branding and short-landscape spacing correct these defects; assertions remain intact.
- `menu-spacing.spec.ts` covers nine viewports from 320x568 and 568x320 through 1440x900: centered portrait sections, separate landscape columns, header/footer gaps, visible actions/records, garage open/close, start, keyboard pause and return. Compact portrait shop centering is checked too.
- Shared checks cover HUD geometry, settings switches, garage rows, long-dialog opening position, result actions in all locales, and offline reload/start with the new stylesheet.
- Final affected recheck: all 56 Chromium/WebKit cases pass, no failures or skips. Exact command and scope are recorded in [spec 08](../specs/08-validation-and-release.md#verification-evidence). Strict typecheck and documentation checks also pass after the final changes; whitespace checks pass.
- Visual references: [portrait](screenshots/menu-layout-2026-11-14/portrait.png) and [landscape](screenshots/menu-layout-2026-11-14/landscape.png).

## Limits

This is an affected-flow review, not a full repository quality audit. Remote pairing, account requests, payments and every translated main-menu label are not re-exercised. Browser emulation and screenshot inspection do not establish physical-device or native-wrapper support; QA-01 remains pending.
