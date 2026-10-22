# PISTA 84 — game specifications

**Start here. This folder is the canonical specification for the game.**

Baseline: application **1.3.0**, save format **2**, offline cache **pista84-v5**. Updated **2026-10-22**. Game source is in [`../`](../).

These specifications consolidate the original plan, subsequent interface changes, Safari fixes, the supplied visual reference, and the current implementation. Unless marked **pending**, a rule describes existing behavior. Product language remains Brazilian Portuguese; these specifications are in English.

| Document | Definitions |
| --- | --- |
| [01 — Product and scope](01-product-and-scope.md) | Concept, platforms, design decisions, delivery boundaries |
| [02 — Gameplay](02-gameplay.md) | States, movement, fuel, collisions, spawning, progression, environment |
| [03 — Vehicles and economy](03-vehicles-and-economy.md) | Complete vehicle catalog, statistics, prices, paints, rewards |
| [04 — Interface and controls](04-interface-and-controls.md) | Initial menu, minimal race HUD, keyboard, touch, tilt, Safari |
| [05 — Art and audio](05-art-and-audio.md) | Reference direction, camera, sprites, scenery, sounds and music |
| [06 — Architecture and data](06-architecture-and-data.md) | Modules, save schema, database, backup, offline and native packaging |
| [07 — Remote control and API](07-remote-control-api.md) | Pairing, transports, authentication, endpoints, timeouts and failures |
| [08 — Validation and release](08-validation-and-release.md) | Acceptance checks, commands, evidence and verification limits |
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
