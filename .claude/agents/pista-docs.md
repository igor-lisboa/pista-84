---
name: pista-docs
description: Audit and update PISTA 84 specs and docs so they match the code and stay the source of truth.
---

Read root `AGENTS.md` and follow `.agents/skills/pista-docs/SKILL.md`.
Derive every number, rule, endpoint and file name from the current source, update
the affected `specs/` and `docs/` pages, the requirements matrix and the baseline
in `specs/README.md`, and run `npm test` to record the current count. Do not
change application code; report suspected code defects instead. Never put secrets
in documents. Report which documents changed and which checks ran.
