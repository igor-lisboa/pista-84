---
name: pista-docs
description: Keep PISTA 84 `specs/` and `docs/` in sync with every code change. Use whenever behavior, data, API, UI text, catalog, audio, environment settings or tests change, and when auditing documentation.
---

`specs/` and `docs/` are the source of truth for PISTA 84. A change is not
finished until the documents say what the product does and the code agrees.

## While making any change

1. **Read first.** Before editing code, read the spec pages that own the area (map
   below). If the request contradicts a spec, say so and ask unless the user has
   explicitly changed the rule. Change the spec first, then the code.
2. **Update in the same change.** Edit every affected page in the same task, not
   later. Keep current behavior separate from proposals; pending work lives only in
   `specs/09-roadmap.md` with its stable ID and acceptance criteria.
3. **Update numbers from code, not memory.** Constants, catalog values, counts
   (vehicles, locales, translation keys, tracks, tests), cache version, endpoints,
   error codes and environment variables must be copied from the source after the change.
4. **Update the matrix and indexes.** Add or adjust the row in
   `specs/10-requirements-matrix.md` (code and tests columns) and the baseline line
   in `specs/README.md` (application version, save format, offline cache name, date)
   when they change. Keep `docs/PENDING.md` a short summary of the roadmap.
5. **Record evidence honestly.** `specs/08-validation-and-release.md` lists the
   checks that actually ran. Never claim physical-device, deployed, payment or
   store validation that did not happen.

## Where things live

| Change | Update |
| --- | --- |
| Rules, physics, fuel, score, traffic, environment | `specs/02-gameplay.md` |
| Vehicles, paints, prices, coins, second chance | `specs/03-vehicles-and-economy.md`, `docs/acceleration-v6.md` when tuning changes |
| Menus, HUD, settings, garage, controls, languages, tutorial | `specs/04-interface-and-controls.md` |
| Rendering, sprites, music, engine sounds | `specs/05-art-and-audio.md`, art provenance in `docs/` |
| Modules, save schema, runtime config, build, offline, native | `specs/06-architecture-and-data.md` |
| Pairing, sockets, HTTP endpoints, error codes | `specs/07-remote-control-api.md` |
| Collections, keys, TTLs, accounts, sessions, deployment | `docs/STORAGE.md` (and 06/07 summaries) |
| Tests, commands, release steps, verification evidence | `specs/08-validation-and-release.md` |
| New, finished or reprioritized work | `specs/09-roadmap.md`, `specs/10-requirements-matrix.md`, `docs/PENDING.md` |
| Known limitations | `docs/TECH-DEBT.md` |
| Docker stack, `scripts/local.sh`, `scripts/check-local.ts` | `docs/STORAGE.md` (Local Docker stack), `specs/06`, `specs/08`, `README.md` |
| User-visible commands, setup, features | `README.md`, `.env.example` |
| New or renamed agents, skills, maintenance policy | `AGENTS.md`, `docs/STORAGE.md` (AI maintenance section) |

## Audit procedure (documentation review)

1. List `src/`, `api/`, `worker/`, `scripts/`, `tests/` and compare with the module
   tables and layouts in `specs/06`.
2. For each spec page, re-derive its numbers and rules from the code it links to
   (for example `race.ts`, `traffic.ts`, `cars.ts`, `vehicle-tuning.ts`,
   `audio.ts`, `tracks.ts`, `save.ts`, `player-api.ts`, `auth.ts`).
3. Count locales and translation keys; check `tests/i18n.test.ts` rules against `specs/04`.
4. Run `npm test`; update the recorded count and any changed coverage rows.
5. Check every relative link and every file or script named in the docs exists.
6. Fix the document, never silently the code. If the code looks wrong, report it
   instead of editing documentation to hide it.

## Rules

- English, concise, present tense; one fact in one canonical place, linked elsewhere.
- Never put secrets, URIs, tokens or `.env` values in documents.
- Preserve roadmap IDs, requirement IDs and acceptance criteria until implemented and verified.
- Do not edit generated output (`www/`, `dist/`, `worker/generated-assets.ts`).
- Report which documents changed and which checks ran.
