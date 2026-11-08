# PISTA 84

Read and follow the repository root `AGENTS.md` for commands, architecture and data invariants.
Use Node 24+, erasable TypeScript and `.ts` relative imports. Build before type checking.
MongoDB owns durable online data; Redis owns expiring pairing/input state. Preserve offline local saves.
Never expose `.env` values, credentials or pairing tokens; never connect normal tests to live databases.
For backend work read `docs/STORAGE.md` and `.agents/skills/pista-storage/SKILL.md`.
For game/UI work read the relevant `specs/` page and `.agents/skills/pista-game/SKILL.md`.
Use `.github/agents/pista-maintainer.agent.md` for the maintenance role.
