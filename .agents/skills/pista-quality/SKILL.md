---
name: pista-quality
description: "Review PISTA 84 quality before completion or release: build, strict TypeScript, tests, user interactions, module size and practical SOLID design."
---

Read `AGENTS.md`, spec 08 and the specs owning the reviewed behavior. Follow
`pista-docs`; use the game, storage, vehicle or localization workflow when relevant.
For an explicit full quality check, inspect the whole current working tree and
run the full automated suite. For routine changes, review the affected code and
interaction paths, clearly identifying the narrower scope. Preserve unrelated edits.

## Build and test gate

- Verify Node 24+. Install with `npm ci` for a fresh environment or changed lockfile.
- Run `npm run build` before `npm run typecheck` (the build generates Worker assets),
  then `npm run docs:check` and `npm test`.
- A full quality check also runs `npm run test:browser` in both configured engines.
  Routine UI changes run the relevant Playwright specs and shared affected flows.
  Use `playwright.config.ts` with live databases disabled and no reused server.
  Do not rebuild or replace dependencies while browser tests are running.
- Investigate failures and rerun the failing check after fixing the cause. Run
  related checks when the fix changes shared behavior. Do not delete assertions,
  loosen types, suppress errors, force clicks or skip cases merely to get green.
  Diagnose timing failures before changing a timeout or retry policy.
- Record failed, passed and skipped cases separately, with commands, scope and
  reasons. An unsupported Web Audio skip is not a passed audible-output check.
  Do not claim all tests pass while any required check failed or was not run.
  Live-service, physical-device and native-build validation require separate evidence.

## Interaction coverage

Inventory controls from HTML, dialogs and input/event bindings, then map each
interaction to a spec and a browser test or an executed manual scenario. A visible
button or a screenshot alone does not establish that the action works. Mark gaps
explicitly and add meaningful coverage for changed behavior rather than tests
that repeat implementation details.

For full reviews, include menu/navigation; tutorial/skip/demo; throttle, brake,
steering, pause/resume and focus loss; crash/fuel results/restart/second chance;
garage purchases, affordability, paint and persistence; settings, audio, language,
units and installation; optional signup/login/logout/error/retry, ranking and
offline progress; file import/export when enabled; controller pairing, input,
disconnect and reconnect. Exercise keyboard and touch, Escape/back/close routes,
disabled actions, double submission and relevant failure/offline paths. Use fakes
and disposable records, preserving identity, wallets and sync outboxes.

Check iPhone SE 375x667 and 667x375, smaller 320x568/568x320 where supported,
tablet 768x1024/1024x768 and desktop portrait/landscape. Check focus, reachable
actions, scroll position, overflow and safe areas; use the localization workflow
for translated text and Urdu RTL. Record emulation separately from real devices.

## TypeScript and design review

- Preserve strict, erasable TypeScript and explicit `.ts` relative imports. Use
  type-only imports where appropriate. Define clear public boundary types and
  narrow `unknown` input with runtime validation before trusting network/storage data.
- Prefer discriminated unions and explicit null/error handling to unrelated
  optional fields. Avoid new `any`, double assertions, unjustified non-null
  assertions, `@ts-ignore` and disabled compiler checks. A cast is not validation.
- Apply SOLID through concrete responsibilities: isolate simulation from DOM,
  persistence/connection setup from business rules and transport from UI. Keep
  interfaces small and preserve their contracts and substitutability. Depend on
  existing narrow interfaces where replacing a service or testing requires it.
  Do not add class hierarchies, generic frameworks or one-use abstraction layers
  simply to name a SOLID principle.
- Keep handwritten implementation modules below 300 physical lines (299 maximum,
  including blanks/comments). Count new and touched files. Split by responsibility
  and stable dependency direction, not arbitrary line ranges; never minify or remove
  useful explanation to meet the limit. List oversized data/catalog/test files too,
  distinguishing data volume from mixed implementation responsibilities.
- Existing oversized implementation modules are tracked in `docs/TECH-DEBT.md`
  and QLT-01. When modifying one, extract the touched responsibility into focused
  modules where feasible within task scope, verify behavior and report any remaining
  overage with a reason and next step. Do not claim repository-wide compliance or
  perform an unrelated wholesale rewrite during a narrow task.

## Review result

Report blockers first with file/line references, then executed checks and coverage
gaps. Distinguish tested interactions from inferred behavior, existing debt from new
regressions, and code review from runtime verification. Update affected specs/docs,
matrix, baseline and roadmap in the same change. Stop short of an all-clear when
required evidence is missing; continue independent checks that can still run.
