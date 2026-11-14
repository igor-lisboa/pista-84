# PISTA 84 maintenance

PISTA 84 is an offline-first TypeScript arcade racer with a browser/PWA client,
Capacitor wrappers, Node/Vercel APIs and an optional static edge Worker.
Read the relevant `specs/` page for game behavior and `docs/STORAGE.md` for backend work.

## Documentation is the source of truth

`specs/` and `docs/` were reconciled with the code on 2026-11-10 and are now the
authoritative definition of the product. Before changing behavior, read the owning
spec; if a request contradicts it, say so and ask, then change the spec first and
the code second. Never edit a document to hide a code defect: report it instead.
Every change that affects behavior, data, endpoints, player text, the vehicle or
audio catalog, environment settings or tests must update the affected `specs/` and
`docs/` pages, `specs/10-requirements-matrix.md`, the baseline in `specs/README.md`
and the roadmap in the same change. Follow `.agents/skills/pista-docs/SKILL.md`.
Real-money coin packs, payments and ads stay pending work in `specs/09-roadmap.md`.

## Commands and conventions

- Use Node 24 or newer. Run `npm ci`, `npm run build`, `npm run typecheck`, `npm run docs:check`, and `npm test` for code changes. Build generates the Worker asset module required by type checking.
- Run the relevant Playwright specs for changes to browser flows, rendering or controls. `playwright.config.ts` disables live databases; do not reuse a server connected to real services for browser tests.
- TypeScript uses erasable syntax, strict checks and explicit `.ts` relative imports. Keep `src/game/` independent of the DOM.
- Keep new handwritten implementation modules below 300 physical lines (299 maximum, including comments and blanks). Split by responsibility, never by minifying or arbitrary chunks. When touching an existing oversized module, extract the affected responsibility where feasible and report remaining overages under QLT-01; do not imply the entire repository already meets this rule.
- Review strict typing and practical SOLID boundaries: validate unknown external data, avoid new `any`/unsafe assertions/error suppressions, keep interfaces narrow and avoid unnecessary abstractions.
- Keep modules focused on one responsibility and use descriptive names and explicit control flow. Prefer small functions and existing interfaces over new abstraction layers. Put test-only storage in `tests/support/`. A junior maintainer should be able to follow connection setup, persistence and business rules separately.
- Code, comments and API errors are English. Put player-facing strings in `src/i18n/locales/` and preserve keys/placeholders across all locales.
- Edit source in `src/`, `web/`, `api/`, `worker/` or `scripts/`. Never hand-edit `www/`, `dist/`, `worker/generated-assets.ts` or `node_modules/`.

## Data invariants

- MongoDB owns scores, manual backups and automatic device snapshots. Preserve GUID identity, highest score/distance, created times and backup revision conflicts (HTTP 409). Automatic snapshots are isolated by player/device; preserve the local sync outbox until acknowledgement and never overwrite manual backups during automatic migration.
- Redis owns shared ephemeral pairing and controller state. Rooms expire after ten minutes; socket presence after fifteen seconds; inputs after two seconds. Use Pub/Sub for cross-instance socket delivery, never high-frequency HTTP polling. Preserve atomic single-controller claims, authorization, reconnect ownership and deletion. No deployed memory fallback.
- Browser localStorage and manual exports preserve offline progress; network errors must not erase or block local play. A missing MongoDB connection must never produce a successful volatile cloud save.
- Never print, commit, bundle or expose `.env` values, database URIs, credentials or pairing tokens. Only `publicConfig()` may determine browser runtime settings.
- Normal tests use isolated fakes. `npm run online:check` deliberately uses configured services with unique, removable probe records; run it when connection verification is requested or needed.
- `bash scripts/local.sh up|check|test|down` runs the game with disposable MongoDB and Redis in Docker (`docker-compose.yml`, generated `.env.docker`) and is the preferred way to verify storage changes without real services. Keep the Compose service URLs pinned and the databases unpublished. Keep `scripts/local.sh` in LF.
- Vercel serves static assets plus `api/*.ts`. Preserve `vercel.json` rewrites. Do not introduce `app`, `index`, `server` or `main` entrypoints at the root, in `src/`, or as browser bundle names: Vercel may auto-detect them as a backend.
- The browser-targeted edge Worker proxies APIs to an HTTPS `API_ORIGIN`; never bundle TCP database drivers into it.

## Reusable workflows

Canonical skills: `.agents/skills/pista-storage/SKILL.md`, `.agents/skills/pista-game/SKILL.md`
and `.agents/skills/pista-docs/SKILL.md` (documentation sync, required for every change).
Claude and Copilot entrypoints point to these workflows; update the canonical files first.
Update relevant specs/docs when behavior, environment settings or storage changes.
Report what changed, which checks ran, and any unresolved limitation. Preserve unrelated user edits.

Vehicle additions and existing-car tuning follow `.agents/skills/pista-vehicles/SKILL.md` (real reference evidence, deliberate arcade exceptions, complete turn-pose review). Every player-text change follows `.agents/skills/pista-localization/SKILL.md` across all fifteen locales. Documentation completion uses the diff-to-spec audit gate in `pista-docs`; code, current specs and docs must agree before completion.

Use `.agents/skills/pista-quality/SKILL.md` as the completion quality review for code changes and explicit quality audits. Full quality audits run all Node and configured Chromium/WebKit tests, inventory user interactions and report missing coverage, failures and skips separately. Claude/Copilot expose the `pista-quality` review agent; Codex follows the same canonical skill. Passing typecheck alone does not establish runtime correctness.
