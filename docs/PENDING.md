# PISTA 84 — pending work

The maintained backlog is [specs/09-roadmap.md](../specs/09-roadmap.md), with priorities, dependencies and completion criteria for every pending item. This page is a short status summary for version **1.4.0**; update the roadmap, not this file, when the work changes.

See the [specification index](../specs/README.md) for all game definitions and the [requirements matrix](../specs/10-requirements-matrix.md) for implemented, partial and pending requirements.

## Done in 1.4

- Full TypeScript codebase (`src/game`, `src/render`, `src/audio`, `src/i18n`, `src/ui`, `src/net`, `src/server`, `src/shared`, `api`, `worker`); no JavaScript source is left. Typecheck with `npm run typecheck`.
- Fatal crashes (any contact with traffic or the barrier), grass drag toward 40 km/h with a fuel and score-multiplier penalty, heavier and smarter traffic (120 s ramp plus 240 s of late-game pressure, lane changes, speed matching, no overlap).
- Pace-based score and coins earned from score (1 coin per 25 points); twenty-two vehicles with authored sprites, all bought with coins; a paid 1,000-coin second chance.
- Old-school Harley Electra Glide touring bike: 6,000 coins, arcade 165 km/h, larger saddlebags/chrome silhouette and synthesized V-twin; [provenance](harley-v1.md).
- Fifteen interface languages, seven procedural race tracks plus a menu loop, per-car engine voices, sunset-arcade interface, top-bar HUD, tutorial, distance units (km/mi) and About dialog.
- MongoDB persistence for scores, accounts, sessions and progress; Redis pairing rooms; WebSocket phone controller with Pub/Sub across instances; offline-first progress outbox with automatic uploads at pause, game end and exit.
- Username/password accounts with salted scrypt hashes, hashed sessions, password change, offline-to-account progress reconciliation and an account-only leaderboard.
- Runtime configuration through `GET /runtime-config.json` (`coins`, `progressTools`).
- Heroku deployment path (`Procfile`, `heroku-postbuild`) next to the Vercel and optional edge Worker adapters.

## Still pending

- Focused implementation modules below 300 lines; six existing TypeScript overages remain, with the quality review workflow implemented (QLT-01).

- **Real-money coin packs, payments, ads and entitlements.** The main-menu coin shop is a disabled "coming soon" placeholder. A billing integration (web checkout, Google Play, App Store), server-authoritative economy, receipt validation and rewarded ads remain to be built (ECO-01, COM-01, ADS-01).
- **Native-speaker review of every non-source translation**, and a complete pt-PT table (I18N-01).
- **Account recovery and lifecycle:** password recovery, MFA, account deletion and sign out everywhere (ACC-01).
- TURN support (NET-01), remote sessions beyond ten minutes (NET-02), Android/iOS signed builds (NAT-01, NAT-02) and physical-device and balance validation (QA-01, QA-02).
- Current technical limitations are listed in [TECH-DEBT.md](TECH-DEBT.md); storage and deployment are documented in [STORAGE.md](STORAGE.md).
