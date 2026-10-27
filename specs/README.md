# PISTA 84 — game specifications

**Start here. This folder is the canonical specification for the game.**

Baseline: application **1.4.0**, save format **2**, offline cache **pista84-v10**. Updated **2026-10-27**. Game source is in [`../`](../).

These specifications consolidate the original plan, subsequent interface changes, Safari fixes, the supplied visual reference, and the current implementation. Unless marked **pending**, a rule describes existing behavior. The interface is available in seven languages (Brazilian Portuguese is the source language); these specifications, all code, comments, identifiers, test names and server error messages are in English.

| Document | Definitions |
| --- | --- |
| [01 — Product and scope](01-product-and-scope.md) | Concept, platforms, design decisions, delivery boundaries |
| [02 — Gameplay](02-gameplay.md) | States, movement, fuel, fatal crashes, off-road, traffic, score, environment |
| [03 — Vehicles and economy](03-vehicles-and-economy.md) | Complete 14-vehicle catalog, statistics, coin and premium prices, paints, score-based rewards |
| [04 — Interface and controls](04-interface-and-controls.md) | Initial menu, top-bar race HUD, keyboard, touch, tilt, languages, Safari |
| [05 — Art and audio](05-art-and-audio.md) | Reference direction, sunset-arcade look, camera, sprites, scenery, procedural music and sounds |
| [06 — Architecture and data](06-architecture-and-data.md) | TypeScript modules, save schema, runtime config, database, backup, offline and native packaging |
| [07 — Remote control and API](07-remote-control-api.md) | Pairing, transports, authentication, endpoints, timeouts and failures |
| [08 — Validation and release](08-validation-and-release.md) | Typecheck, test commands, evidence and verification limits |
| [09 — Roadmap](09-roadmap.md) | Remaining work, priorities, dependencies and completion criteria |
| [10 — Requirements matrix](10-requirements-matrix.md) | Original-plan requirements mapped to implementation and pending items |

## Reading and maintenance rules

1. Read product, gameplay and interface before making game changes.
2. Use the catalog and API documents when changing balance or persistence; do not infer their contracts from screenshots.
3. Update the affected specification in the same change as the implementation. Keep current behavior separate from proposals.
4. Preserve roadmap IDs and acceptance criteria until the corresponding work is implemented and verified.
5. Never claim physical-device validation, signed native builds, working payments or actual ad rewards without the required evidence.

## Other useful material

- [Run the project](../README.md)
- [Art provenance and exact generation prompts](../docs/ART_DIRECTION.md)
- [Rendered reference composition](../docs/screenshots/reference-scene.png)
- [Published private game](https://pista-84-igor.amberstoat8.chatgpt.site)

The old `docs/SPECS.md` and `PENDENCIAS.md` paths are navigation pointers to this folder. They are not a second specification to maintain.
