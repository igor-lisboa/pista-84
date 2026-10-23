# 10 — Requirements and implementation status

[Specification index](README.md)

Stable IDs correspond to the original-plan areas. **Implemented** means behavior exists in the current source; **partial** means the delivered portion and remaining work are explicitly distinguished.

| ID | Requirement | Status | Definition / remaining work |
| --- | --- | --- | --- |
| R01 | Infinite road-running race | Implemented for solo | [Gameplay](02-gameplay.md); remote room lifetime has NET-02 limitation |
| R02 | Desktop steering, acceleration and braking | Implemented | [Controls](04-interface-and-controls.md) |
| R03 | Mobile touch and optional tilt | Implemented; physical QA pending | [Controls](04-interface-and-controls.md), QA-01 |
| R04 | Continuous fuel use and collectible canisters | Implemented | Capacity, drain, spawns and refill in [gameplay](02-gameplay.md) |
| R05 | Recoverable traffic impacts and empty-tank failure | Implemented | Impact speed retention and contact thresholds in [gameplay](02-gameplay.md) |
| R06 | Distance/speed/fuel feedback | Implemented | Minimal race HUD; wallet/record/settings outside the race |
| R07 | Increasing difficulty and visible curves | Implemented | Increasing traffic frequency; seeded endless road with varied straights and bounded left/right bends |
| R08 | Day/sunset/night/dawn and clear/rain/fog | Implemented | Timing/interpolation/grip in [gameplay](02-gameplay.md); presentation in [art](05-art-and-audio.md) |
| R09 | National cars, motorcycles and distinct attributes | Implemented | Eight vehicles and impact retention/handling differences in [catalog](03-vehicles-and-economy.md) |
| R10 | Free currency, unlocks and cosmetics | Implemented | Settlement, prices and paints; editable casual save is not a trusted paid wallet |
| R11 | Second chance and ad rewards | Partial | One free continuation exists; actual rewarded continuation/doubling pending ADS-01 |
| R12 | Retro music and vehicle-specific engine/braking | Implemented as synthesized audio | [Audio definitions](05-art-and-audio.md); physical mixing validation pending QA-01 |
| R13 | Phone as secondary gamepad with QR | Implemented, with lifetime limit | WebRTC/HTTPS, mobile start/pause; [API](07-remote-control-api.md); NET-02 |
| R14 | Responsive web architecture | Implemented | Full viewport, real Canvas aspect, safe areas, portrait/landscape, offline PWA |
| R15 | Real premium currency, payments and ad removal | Pending | ECO-01, COM-01 and ADS-01; current catalog uses only free coins |
| R16 | Native Android/iOS packaging | Partial | Projects/assets generated and synced; compiled/signed/device-validated distribution pending NAT-01/NAT-02/QA-01 |
| UX01 | Initial menu instead of surrounding dashboard | Implemented | [Menu and overlays](04-interface-and-controls.md) |
| UX02 | Minimal information during actual driving | Implemented | Essential HUD only; touch controls remain usable |
| ART01 | Latest supplied visual reference | Implemented | City, conifers, blue/white road borders, larger perspective sprites; [art direction](05-art-and-audio.md) |
| DATA01 | Persistent record, ownership and manual backup | Implemented for casual progress | [Data schema](06-architecture-and-data.md); commercial integrity pending ECO-01 |
| DOC01 | Findable, consolidated game definitions | Implemented by this folder | Root `specs/README.md` is the starting point; legacy spec paths redirect here |

Validation baseline and its limits are in [08 — Validation and release](08-validation-and-release.md). Future acceptance criteria are in [09 — Roadmap](09-roadmap.md).
