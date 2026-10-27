# 01 — Product and scope

[Specification index](README.md)

## Game definition

**PISTA 84** is a browser-based infinite road-racing arcade set around Brazilian cars and nostalgic 16-bit presentation. The player steers through traffic, collects fuel and tries to travel as far as possible. Score is paid per metre and scaled by the pace of each kilometre; score determines the free-currency (coin) rewards.

The experience is a playable racing game with an initial menu, rather than a dashboard surrounding a small game canvas. Presentation follows the supplied racing reference for the scene (elevated rear-view vehicles, a winding road, city skyline, trees) wrapped in the 1.4 sunset-arcade interface, with minimal information during play.

## Core loop

1. Choose a vehicle and optional paint in the garage.
2. Start a new run from the initial menu, keyboard or paired phone.
3. Steer around traffic; accelerate or brake when useful.
4. Collect fuel, survive changing curves/weather and accumulate distance.
5. End the run through a crash (any contact with traffic or the barrier) or an empty tank. Stopping alone does not end a run.
6. Use one free second chance or return to the menu; spend earned coins on vehicles and paints.

## Product decisions

| Topic | Current definition |
| --- | --- |
| Genre | Infinite runner expressed as road racing; no finish line or lap system |
| Locale | Fifteen interface languages (pt-BR source, en, pt-PT, fr, it, ja, de), chosen in the options, defaulting to the browser language; localized number formatting |
| Platforms | Desktop and mobile browsers; portrait and landscape layouts |
| Input | Keyboard, on-screen controls, optional tilt, paired phone controller |
| Main display | Responsive Canvas occupying the available application viewport |
| Initial vehicle | Fusca 76, already owned; existing selections are preserved in saved progress |
| Access | The deployed Site is private and requires its authorized account |
| Offline | Solo play after a successful first visit and asset caching |
| Progress | Local browser save (v2), file export/import, manual account backup on hosted runtime |
| Code | Full TypeScript; Node 24 runs `.ts` natively, `tsc --noEmit` type-checks, esbuild bundles |
| Monetization | Two PREMIUM cars are priced in real money (BRL) behind the `CashStore` interface, but no payment provider is connected: the default store is unavailable. No premium wallet or ads are connected |
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

Premium cars cannot be bought with coins in the garage, but ownership is only a list of ids in the editable local save (an imported or edited save can contain them); a billing integration implementing `CashStore` and server-side entitlements is still pending ([ECO-01 and COM-01](09-roadmap.md)). The account backup is a convenience for casual progress. It does not validate that client-reported coins were earned legitimately.
