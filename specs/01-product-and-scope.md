# 01 — Product and scope

[Specification index](README.md)

## Game definition

**PISTA 84** is a browser-based infinite road-racing arcade set around Brazilian cars and nostalgic 16-bit presentation. The player steers through traffic, collects fuel and tries to travel as far as possible. Distance determines the run's score and free-currency rewards.

The experience is a playable racing game with an initial menu, rather than a dashboard surrounding a small game canvas. Presentation follows the supplied racing reference: elevated rear-view vehicles, a winding road, city skyline, trees, restrained colors and minimal information during play.

## Core loop

1. Choose a vehicle and optional paint in the garage.
2. Start a new run from the initial menu, keyboard or paired phone.
3. Steer around traffic; accelerate or brake when useful.
4. Collect fuel, survive changing curves/weather and accumulate distance.
5. End the run through collision, empty fuel or stopping.
6. Use one free second chance or return to the menu; spend earned coins on vehicles and paints.

## Product decisions

| Topic | Current definition |
| --- | --- |
| Genre | Infinite runner expressed as road racing; no finish line or lap system |
| Locale | Brazilian Portuguese interface, localized distance formatting |
| Platforms | Desktop and mobile browsers; portrait and landscape layouts |
| Input | Keyboard, on-screen controls, optional tilt, paired phone controller |
| Main display | Responsive Canvas occupying the available application viewport |
| Initial vehicle | Fusca 76, already owned; existing selections are preserved in saved progress |
| Access | The deployed Site is private and requires its authorized account |
| Offline | Solo play after a successful first visit and asset caching |
| Progress | Local browser save, file export/import, manual account backup on hosted runtime |
| Monetization | No real payments, premium wallet or ads connected |
| Native | Android/iOS Capacitor projects exist; distributable builds are not validated or signed |

## Design priorities

- During a run, the road and vehicles take priority over UI.
- Garage, settings, help, balances and backup belong in menus.
- Touch buttons must work without motion permission or WebRTC.
- A paired phone can start and pause the main screen, not just steer it.
- Browser restrictions must have a usable fallback or a clear explanation.
- Existing casual progress must survive visual updates.

## Outside the current delivery

There is no multiplayer racing, global leaderboard, campaign, upgrade-performance tree, real premium entitlement, account-authoritative race economy or signed store release. The original monetization and native-distribution goals remain defined in the [roadmap](09-roadmap.md); they are not presented as live features.

The account backup is a convenience for casual progress. It does not validate that client-reported coins were earned legitimately.
