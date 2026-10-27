# PISTA 84 — pending work

The maintained backlog is [specs/09-roadmap.md](../specs/09-roadmap.md), with priorities, dependencies and completion criteria for every pending item. This page is a short status summary for version **1.4.0**; update the roadmap, not this file, when the work changes.

See the [specification index](../specs/README.md) for all game definitions and the [requirements matrix](../specs/10-requirements-matrix.md) for implemented, partial and pending requirements.

## Done in 1.4

- Full TypeScript migration (`src/game`, `src/render`, `src/audio`, `src/i18n`, `src/ui`, `src/net`, `src/server`, `src/shared`); no JavaScript source is left. Typecheck with `npm run typecheck`.
- Fatal crashes (any contact with traffic or the barrier), grass drag toward 40 km/h, heavier and smarter traffic (240 s ramp, lane changes, speed matching, no overlap).
- Pace-based score and coins earned from score (1 coin per 25 points); 14 vehicles; two premium cars behind the `CashStore` interface.
- Seven interface languages, procedural music (menu loop plus three race tracks), per-car engine voices, redesigned sunset-arcade interface and top-bar HUD.
- Runtime configuration through `GET /runtime-config.json` instead of a generated module.

## Still pending

- **Real payment provider for the premium cars.** `CashStore` (`src/ui/store.ts`) has only the default "unavailable" implementation; a billing integration (web checkout, Google Play, App Store) must implement it, together with server-side entitlements and receipt validation (ECO-01, COM-01).
- **Authored atlas art for the six newer vehicles** (Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS, Maverick GT). They use procedural pixel sprites with no authored straight, mild-turn or strong-turn frames (ART-01).
- **Native-speaker review of the translations** (en, pt-PT, fr, it, ja, de), including pt-PT, which only overrides part of the pt-BR strings (I18N-01).
- Rewarded ads and ad removal (ADS-01), TURN support (NET-01), remote sessions beyond ten minutes (NET-02), Android/iOS signed builds (NAT-01, NAT-02) and physical-device and balance validation (QA-01, QA-02).
