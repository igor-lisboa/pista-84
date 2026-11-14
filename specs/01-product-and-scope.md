# 01 — Product and scope

[Specification index](README.md)

## Game definition

**PISTA 84** is a browser-based infinite road-racing arcade set around Brazilian cars and nostalgic 16-bit presentation. The player steers through traffic, collects fuel and tries to travel as far as possible. Score is paid per metre and scaled by the pace of each kilometre; score determines the free-currency (coin) rewards.

The experience is a playable racing game with an initial menu, rather than a dashboard surrounding a small game canvas. Presentation follows the supplied racing reference for the scene (elevated rear-view vehicles, a winding road, city skyline, trees) wrapped in the 1.4 sunset-arcade interface, with minimal information during play.

## Core loop

1. First launch opens the tutorial, then offers a one-time demo. Account creation/login is suggested through an optional action after the demo, and remains accessible in Settings and the ranking. Only accounts can publish to the ranking and sync progress; guest racing remains fully offline.
2. Choose a vehicle and optional paint in the garage.
3. Start a new run from the initial menu, keyboard or paired phone.
4. Steer around traffic; accelerate or brake when useful.
5. Collect fuel, survive changing curves/weather and accumulate distance.
6. End the run through a crash (any contact with traffic or the barrier) or an empty tank. Stopping alone does not end a run.
7. Buy the single 1,000-coin second chance or restart or return to the menu; spend earned coins on vehicles and paints. Signed-in pilots appear in the online ranking.

## Product decisions

| Topic | Current definition |
| --- | --- |
| Genre | Infinite runner expressed as road racing; no finish line or lap system |
| Locale | Fifteen interface languages (pt-BR source, en, pt-PT, fr, it, ja, de, es, hi, zh-CN, id, ur, bn, ru, am), chosen in the options, defaulting to the browser language; localized number formatting; distances and speeds in kilometres or miles (player choice) |
| Platforms | Desktop and mobile browsers; portrait and landscape layouts |
| Input | Keyboard, on-screen controls, optional tilt, paired phone controller |
| Main display | Responsive Canvas occupying the available application viewport |
| Initial vehicle | Fusca 76, already owned; existing selections are preserved in saved progress |
| Access | The game is public and playable by guests. Sign-up or log-in is offered after the first demo and through explicit menu actions, never required; guests play fully offline and never contact the online API. The reference deployment is a Heroku Node dyno (see [storage documentation](../docs/STORAGE.md#heroku)) |
| Offline | Solo play after a successful first visit and asset caching |
| Progress | Local browser save (v2) and file export/import for everyone; optional username/password account that merges progress across devices; automatic device snapshots and account sync for signed-in players. There is no manual cloud backup button |
| Ranking | Online leaderboard (five pilots per page) for signed-in players only; guests see an explanatory message |
| Code | Full TypeScript; Node 24 runs `.ts` natively, `tsc --noEmit` type-checks, esbuild bundles |
| Monetization | All 21 vehicles use coins, with prices from 0 to 30,000 and no premium category. The menu's "Buy coins" dialog only previews planned packs with disabled "coming soon" buttons. No payment provider, premium wallet or ads are connected |
| Native | Android/iOS Capacitor projects exist; distributable builds are not validated or signed |

## Design priorities

- During a run, the road and vehicles take priority over UI.
- Garage, settings, help, balances and the account belong in menus.
- Touch buttons must work without motion permission or WebRTC.
- A paired phone can start and pause the main screen, not just steer it.
- Browser restrictions must have a usable fallback or a clear explanation.
- Existing casual progress must survive visual updates.
- Network failure must never block local play or erase local progress.
- A first-time player who does not move gets a short how-to-play tutorial.

## Outside the current delivery

There is no multiplayer racing, campaign, upgrade-performance tree, real premium entitlement, account-authoritative race economy or signed store release. The leaderboard is a casual, client-reported ranking, not a competitive one. The original monetization and native-distribution goals remain defined in the [roadmap](09-roadmap.md); they are not presented as live features. Real-money coin packs, payments and ad rewards are pending work (ECO-01, COM-01, ADS-01).

Ownership is only a list of ids in the editable local save (an imported or edited save can contain any car); server-side entitlements are still pending ([ECO-01 and COM-01](09-roadmap.md)). Account progress and device snapshots are a convenience for casual progress. They do not validate that client-reported coins or scores were earned legitimately. Password recovery, account renaming and account deletion are not implemented ([storage documentation](../docs/STORAGE.md)).
