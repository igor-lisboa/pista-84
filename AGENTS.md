# PISTA 84 maintenance

PISTA 84 is an offline-first TypeScript arcade racer with a browser/PWA client,
Capacitor wrappers, Node/Vercel APIs and an optional static edge Worker.
Read the relevant `specs/` page for game behavior and `docs/STORAGE.md` for backend work.

## Commands and conventions

- Use Node 24 or newer. Run `npm ci`, `npm run build`, `npm run typecheck`, and `npm test` for code changes. Build generates the Worker asset module required by type checking.
- Run the relevant Playwright specs for changes to browser flows, rendering or controls. `playwright.config.ts` disables live databases; do not reuse a server connected to real services for browser tests.
- TypeScript uses erasable syntax, strict checks and explicit `.ts` relative imports. Keep `src/game/` independent of the DOM.
- Keep modules focused on one responsibility and use descriptive names and explicit control flow. Prefer small functions and existing interfaces over new abstraction layers. Put test-only storage in `tests/support/`. A junior maintainer should be able to follow connection setup, persistence and business rules separately.
- Code, comments and API errors are English. Put player-facing strings in `src/i18n/locales/` and preserve keys/placeholders across all locales.
- Edit source in `src/`, `web/`, `api/`, `worker/` or `scripts/`. Never hand-edit `www/`, `dist/`, `worker/generated-assets.ts` or `node_modules/`.

## Data invariants

- MongoDB owns scores, manual backups and automatic device snapshots. Preserve GUID identity, highest score/distance, created times and backup revision conflicts (HTTP 409). Automatic snapshots are isolated by player/device; preserve the local sync outbox until acknowledgement and never overwrite manual backups during automatic migration.
- Redis owns shared ephemeral pairing and controller state. Rooms expire after ten minutes; inputs after two seconds. Preserve atomic single-controller claims, authorization and deletion. No deployed memory fallback.
- Browser localStorage and manual exports preserve offline progress; network errors must not erase or block local play. A missing MongoDB connection must never produce a successful volatile cloud save.
- Never print, commit, bundle or expose `.env` values, database URIs, credentials or pairing tokens. Only `publicConfig()` may determine browser runtime settings.
- Normal tests use isolated fakes. `npm run online:check` deliberately uses configured services with unique, removable probe records; run it when connection verification is requested or needed.
- Vercel serves static assets plus `api/*.ts`. Preserve `vercel.json` rewrites. Do not introduce `app`, `index`, `server` or `main` entrypoints at the root, in `src/`, or as browser bundle names: Vercel may auto-detect them as a backend.
- The browser-targeted edge Worker proxies APIs to an HTTPS `API_ORIGIN`; never bundle TCP database drivers into it. Historical `db/` and `drizzle/` files are not the active schema.

## Reusable workflows

Canonical skills: `.agents/skills/pista-storage/SKILL.md` and `.agents/skills/pista-game/SKILL.md`.
Claude and Copilot entrypoints point to these workflows; update the canonical files first.
Update relevant specs/docs when behavior, environment settings or storage changes.
Report what changed, which checks ran, and any unresolved limitation. Preserve unrelated user edits.
