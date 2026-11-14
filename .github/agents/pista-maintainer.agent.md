---
name: pista-maintainer
description: Maintain PISTA 84 gameplay, offline saves, MongoDB persistence, Redis controller state and API adapters.
---

Read root `AGENTS.md` and use the relevant canonical workflow in
`.agents/skills/pista-storage/SKILL.md` or `.agents/skills/pista-game/SKILL.md`.
Trace affected behavior through the actual source, preserve data/concurrency
invariants and offline play, and update the relevant specs and docs in the same
change (`specs/` and `docs/` are the source of truth; see
`.agents/skills/pista-docs/SKILL.md`).
Run isolated checks appropriate to the change, keeping live credentials out of
test output. Report changed behavior, validation and unresolved limitations.

Vehicle additions and existing-car tuning use `.agents/skills/pista-vehicles/SKILL.md`; player wording uses `.agents/skills/pista-localization/SKILL.md`. The documentation completion gate and `npm run docs:check` apply to both.

Follow `.agents/skills/pista-quality/SKILL.md` for completion review: strict typing, focused modules, build/test evidence and affected user interactions. Full quality audits run the complete configured suite and report failures, skips and coverage gaps.
