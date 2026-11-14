# PISTA 84 — game specifications

**Start here. This folder is the canonical specification for the game.**

Baseline: application **1.4.0**, save format **2**, offline cache **pista84-v30**. Reconciled with the code on **2026-11-14**. Game source is in [`../`](../).

These specifications are the **source of truth** for the game. They were reconciled with the implementation on 2026-11-14; from then on a behavior change starts here and the code follows (see the maintenance rules below). Unless marked **pending**, a rule describes existing behavior. The interface is available in fifteen languages (Brazilian Portuguese is the source language); these specifications, all code, comments, identifiers, test names and server error messages are in English.

| Document | Definitions |
| --- | --- |
| [01 — Product and scope](01-product-and-scope.md) | Concept, platforms, design decisions, delivery boundaries |
| [02 — Gameplay](02-gameplay.md) | States, movement, fuel, fatal crashes, off-road, traffic, score, environment |
| [03 — Vehicles and economy](03-vehicles-and-economy.md) | Complete 21-vehicle catalog, statistics, coin prices, paints, score-based rewards, paid second chance |
| [04 — Interface and controls](04-interface-and-controls.md) | Initial menu, top-bar race HUD, accounts, leaderboard, tutorial, keyboard, touch, tilt, fifteen languages, Safari |
| [05 — Art and audio](05-art-and-audio.md) | Reference direction, sunset-arcade look, camera, sprites, scenery, procedural music and sounds |
| [06 — Architecture and data](06-architecture-and-data.md) | TypeScript modules, save schema, runtime config, accounts, MongoDB/Redis, offline sync, offline and native packaging |
| [07 — Remote control and API](07-remote-control-api.md) | Pairing, WebSocket transport, HTTP endpoints (rooms, auth, account, progress, score, leaderboard), timeouts and failures |
| [08 — Validation and release](08-validation-and-release.md) | Typecheck, test commands, evidence and verification limits |
| [09 — Roadmap](09-roadmap.md) | Remaining work, priorities, dependencies and completion criteria |
| [10 — Requirements matrix](10-requirements-matrix.md) | Original-plan requirements mapped to implementation and pending items |

## Reading and maintenance rules

1. Read product, gameplay and interface before making game changes.
2. Use the catalog and API documents when changing balance or persistence; do not infer their contracts from screenshots.
3. Specifications lead: change the affected page first (or in the same change as the implementation) and keep current behavior separate from proposals. Never edit a page to hide a code defect; report it instead. Agents follow [`.agents/skills/pista-docs/SKILL.md`](../.agents/skills/pista-docs/SKILL.md).
4. Preserve roadmap IDs and acceptance criteria until the corresponding work is implemented and verified.
5. Never claim physical-device validation, signed native builds, working payments or actual ad rewards without the required evidence.

## Other useful material

- [Run the project](../README.md)
- [Art provenance and exact generation prompts](../docs/ART_DIRECTION.md)
- [Rendered reference composition](../docs/screenshots/reference-scene.png)
- [Storage, accounts and deployment](../docs/STORAGE.md)
- [Known limitations](../docs/TECH-DEBT.md)

`docs/SPECS.md` and `docs/PENDING.md` are navigation pointers to this folder (the latter carries a short status summary of the backlog). They are not a second specification to maintain. The other files in `docs/` are provenance, tuning records and operations guides referenced from the specs.

Maintenance audit and evidence: [2026-11-14 audit](../docs/audit-2026-11-14.md). Run `npm run docs:check` to validate catalog, tuning, audio tables, baseline and local links.

Maintenance baseline (2026-11-14): the [quality review contract](08-validation-and-release.md#quality-review-contract) adds strict typing/SOLID review, interaction evidence and a below-300-line implementation target; existing module-size debt is QLT-01. Application/save/cache versions above are unchanged by this guidance-only addition.
