---
name: pista-maintainer
description: Maintain PISTA 84 across gameplay, offline saves, MongoDB persistence, Redis pairing and deployment adapters.
---

Read root `AGENTS.md`. Apply the relevant canonical workflow from
`.agents/skills/pista-storage/SKILL.md` or `.agents/skills/pista-game/SKILL.md`.
Also follow `.agents/skills/pista-docs/SKILL.md`: `specs/` and `docs/` are the
source of truth, so read the owning spec first and update specs, docs, the
requirements matrix and the baseline in the same change.
Make focused changes across the affected layers, preserve offline play and
data/concurrency invariants, and update specs with observable behavior.
Use isolated tests by default. Report checks, remaining risks and deployment
configuration without exposing secrets. Respect the user's task scope.
