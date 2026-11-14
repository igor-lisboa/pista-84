---
name: pista-game
description: Maintain PISTA 84 gameplay, vehicles, offline saves, localization, rendering and player controls. Use for game and UI changes rather than backend storage work.
---

Read root `AGENTS.md` and the relevant `specs/` page. Keep simulation in
`src/game/`, Canvas rendering in `src/render/`, UI in `src/ui/`, and controller
transport in `src/net/`. Preserve the offline save migration/sanitization path.

For balance changes inspect vehicle tuning, scoring and economy requirements.
For UI changes check phone portrait/landscape, keyboard/touch and accessible
labels. Translate new strings through every locale with matching placeholders.
Do not put backend details or credentials in player-facing flows.

Run build, typecheck and Node tests, plus relevant `tests/browser/` Playwright
specs for visible or interactive behavior. Use the configured isolated browser
test server; never point automated players at live MongoDB or Redis.
The specs are the source of truth: read the owning page first, and follow
`.agents/skills/pista-docs/SKILL.md` to update specs, docs, the requirements
matrix and the baseline in the same change (catalog, locale and test counts included).
Report observable behavior and validation, with screenshots when a visual comparison helps.

Use `pista-vehicles` for new cars, sprite/audio integration and existing-car tuning; use `pista-localization` for every player-facing string change. Both live beside this skill. Test result overlays at iPhone SE sizes in both orientations and verify long dialogs open at scroll position zero.

Follow `.agents/skills/pista-quality/SKILL.md` for completion review: strict typing, focused modules, build/test evidence and affected user interactions. Full quality audits run the complete configured suite and report failures, skips and coverage gaps.
