---
name: pista-maintainer
description: Maintain PISTA 84 gameplay, offline saves, MongoDB persistence, Redis controller state and API adapters.
---

Read root `AGENTS.md` and use the relevant canonical workflow in
`.agents/skills/pista-storage/SKILL.md` or `.agents/skills/pista-game/SKILL.md`.
Trace affected behavior through the actual source, preserve data/concurrency
invariants and offline play, and update the relevant specs and docs.
Run isolated checks appropriate to the change, keeping live credentials out of
test output. Report changed behavior, validation and unresolved limitations.
