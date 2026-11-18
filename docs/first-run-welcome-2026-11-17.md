# First-run welcome review — 2026-11-17

Scope: UX09 onboarding and its shared tutorial/account entry paths. The welcome
explains the one-race Veloce GT loan before the player drives, then names the
selected owned vehicle and explains racing for coins and garage unlocks. A new
player sees Fusca 76. Continue, close and Escape lead to the tutorial only when
it has not been completed or skipped. The existing demo result reminder remains.
No new save fields, ownership changes or account requirements are introduced.

The six new messages have explicit translations in all fifteen locales,
including European Portuguese. Source keys: 259; pt-PT overrides: 192.
The welcome reappears on reload while the demo remains unused; it disappears
after the first completed demo. Saved vehicle choices are preserved.

Diff-to-spec audit: interface behavior and locale counts map to spec 04;
UX09 code/test references map to the requirements matrix; the baseline and
roadmap record the change. Language documentation records the six new messages.
Existing artwork, physics, catalog, audio and backend contracts are unaffected.

Validation: Node 24.22.1, dependency installation, build, strict typecheck,
documentation consistency and the 299-line production-module gate pass.
All 184 Node tests pass, with no failures or skips. The initial focused browser
run had 98 passes and four failures: in each engine, focusing Continue scrolled
the 568×320 welcome by 16 pixels, and the installation test attempted to open
Settings behind the welcome after reload. Focus now preserves scroll position;
short landscape spacing is reduced; the installation test acknowledges the
pending-demo welcome after reload. The final focused Chromium/WebKit run passes
all 104 tests in 7.1 minutes, with no failures or skips. The final Node rerun also
passes all 184 tests, with no failures or skips.

Executed commands: dependency installation with Node 24, `npm run build`,
`npm run typecheck`, `npm run docs:check`, `npm run quality:modules`, `npm test`
and the Playwright CLI for `first-run-welcome`, `tutorial`, `demo-guest`,
`demo-transition`, `username`, `languages`, `install-depth` and `account.spec`.
No production or test module overages are reported by the size gate.

Visual review uses browser-emulated phone, tablet and desktop viewports in both
orientations. Captures live under ignored `test-results/`. The 320×568 pt-BR
capture has readable stages, a clear action and a centered close icon. Urdu RTL,
Japanese, Chinese, Hindi, Bengali and Amharic captures preserve readable text
and reachable actions. The 667×375 and 1024×768 captures retain the same hierarchy.
Corrected `welcome-pt-BR-568x320.png` captures are reviewed in both engines;
`welcome-safe-852x393.png` confirms the four simulated safe insets. Automated
coverage checks all fifteen locales at eight viewport sizes, preserves the
selected owned car, exercises Continue/close/Escape, and verifies tutorial and
completed-demo suppression. The safe-inset case also covers 393×852 portrait.
Native-speaker sign-off, native builds and physical-device checks are not claimed;
I18N-01 and QA-01 remain pending. This is a focused review, not a full-game audit.
