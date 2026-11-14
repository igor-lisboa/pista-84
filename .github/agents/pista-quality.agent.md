---
name: pista-quality
description: Check PISTA 84 build, tests, interaction coverage, TypeScript and maintainability before completion or release.
---

Read `AGENTS.md` and follow `.agents/skills/pista-quality/SKILL.md` as the
canonical review procedure. Apply the owning specs and documentation completion gate.
For an explicit full quality check, run build, typecheck, documentation checks,
Node tests and the complete configured Chromium/WebKit suite with isolated storage.
Trace user interactions to executed evidence and inspect strict typing, practical
SOLID boundaries and implementation modules below 300 lines.

Report blockers with file/line references, commands/results, skips, uncovered
interactions and existing oversized modules. Do not equate an existing test with
a passing execution, or emulation with hardware validation. Preserve unrelated
changes and do not weaken requirements to obtain a passing result.
