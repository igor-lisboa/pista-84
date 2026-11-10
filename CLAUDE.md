@AGENTS.md

Use `AGENTS.md` as the shared repository maintenance policy.
For storage/API work load `.claude/skills/pista-storage/SKILL.md`; for game/UI work
load `.claude/skills/pista-game/SKILL.md`. For every change that alters behavior,
data, APIs, text, catalog or tests, also load `.claude/skills/pista-docs/SKILL.md`:
`specs/` and `docs/` are the source of truth and are updated in the same change.
Their canonical workflows live under `.agents/skills/`. The `pista-maintainer`
agent handles cross-layer maintenance; the `pista-docs` agent audits and updates
specs and docs.
